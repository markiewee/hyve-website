# Smart Expense Import & Auto-Tagging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual expense entry with an intelligent import pipeline that pulls transactions (CSV now, Aspire API later), auto-tags them by property and category using learned patterns, and lets Mark review/confirm with a drag-to-retag UI.

**Architecture:** CSV upload drops transactions into a `bank_transactions` staging table. A tagging engine matches transactions against learned rules in `tagging_rules` (vendor pattern → property + category). Unmatched transactions surface in a review UI where Mark drags them to the correct bucket — each confirmation creates/strengthens a rule. Confirmed transactions become `property_expenses`. The existing `AdminFinancialsPage` and `InvestorDashboardPage` continue working unchanged since they already read from `property_expenses`.

**Tech Stack:** React 19, Supabase Postgres, Vite, Tailwind CSS, shadcn/ui, @dnd-kit/core (drag-and-drop), Papa Parse (CSV parsing)

---

## File Structure

```
src/
├── pages/portal/
│   ├── AdminExpenseImportPage.jsx      # CSV upload + review/tag UI (NEW)
│   └── AdminExpensesPage.jsx           # Existing — no changes needed
├── components/portal/
│   ├── CsvUploader.jsx                 # Drag-drop CSV upload zone (NEW)
│   ├── TransactionReviewBoard.jsx      # Kanban-style review board (NEW)
│   ├── TransactionCard.jsx             # Draggable transaction card (NEW)
│   └── CategoryColumn.jsx             # Drop target column (NEW)
├── hooks/
│   ├── useTransactionImport.js         # CSV parse + upload logic (NEW)
│   ├── useTaggingEngine.js             # Auto-tag + rule management (NEW)
│   └── useTransactionReview.js         # Review board state (NEW)
├── lib/
│   └── tagging.js                      # Pure tagging logic — match rules (NEW)
supabase/
└── migrations/
    └── 20260327000000_expense_import.sql  # New tables (NEW)
```

---

### Task 1: Database Schema — Staging & Rules Tables

**Files:**
- Create: `supabase/migrations/20260327000000_expense_import.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Staging table for imported bank transactions
CREATE TABLE bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id uuid NOT NULL,
  transaction_date date NOT NULL,
  description text NOT NULL,
  amount numeric(12,2) NOT NULL,
  currency text DEFAULT 'SGD',
  reference text,
  -- Tagging fields (null = unreviewed)
  property_id uuid REFERENCES properties(id),
  category text,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'AUTO_TAGGED', 'CONFIRMED', 'IGNORED')),
  confidence numeric(3,2) DEFAULT 0,
  matched_rule_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Learned tagging rules
CREATE TABLE tagging_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_pattern text NOT NULL,
  property_id uuid REFERENCES properties(id),
  category text NOT NULL,
  hit_count int DEFAULT 1,
  last_used_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(vendor_pattern, property_id, category)
);

-- Import batch tracking
CREATE TABLE import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text,
  row_count int DEFAULT 0,
  auto_tagged_count int DEFAULT 0,
  confirmed_count int DEFAULT 0,
  status text DEFAULT 'PROCESSING'
    CHECK (status IN ('PROCESSING', 'REVIEWING', 'COMPLETE')),
  created_at timestamptz DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX idx_bank_txn_status ON bank_transactions(status);
CREATE INDEX idx_bank_txn_batch ON bank_transactions(import_batch_id);
CREATE INDEX idx_tagging_rules_pattern ON tagging_rules(vendor_pattern);

-- RLS policies (admin only)
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tagging_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access bank_transactions"
  ON bank_transactions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM tenant_profiles
    WHERE user_id = auth.uid() AND role = 'ADMIN'
  ));

CREATE POLICY "Admin full access tagging_rules"
  ON tagging_rules FOR ALL
  USING (EXISTS (
    SELECT 1 FROM tenant_profiles
    WHERE user_id = auth.uid() AND role = 'ADMIN'
  ));

CREATE POLICY "Admin full access import_batches"
  ON import_batches FOR ALL
  USING (EXISTS (
    SELECT 1 FROM tenant_profiles
    WHERE user_id = auth.uid() AND role = 'ADMIN'
  ));
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push` or apply via Supabase dashboard SQL editor.
Expected: Three new tables created with RLS policies.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260327000000_expense_import.sql
git commit -m "feat: add bank_transactions, tagging_rules, import_batches tables"
```

---

### Task 2: Tagging Engine — Pure Logic

**Files:**
- Create: `src/lib/tagging.js`

- [ ] **Step 1: Write the tagging matcher**

```js
/**
 * Normalize a transaction description for matching.
 * Strips whitespace, lowercases, removes common noise words.
 */
export function normalizeDescription(desc) {
  return desc
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\b(pte|ltd|sdn|bhd|sg|sgd)\b/gi, "")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

/**
 * Score how well a rule's vendor_pattern matches a transaction description.
 * Returns 0-1 confidence score. 0 = no match.
 */
export function matchScore(rulePattern, transactionDesc) {
  const normRule = normalizeDescription(rulePattern);
  const normDesc = normalizeDescription(transactionDesc);

  // Exact match
  if (normDesc === normRule) return 1.0;

  // Description contains the pattern
  if (normDesc.includes(normRule)) return 0.9;

  // Pattern contains the description (less likely but possible)
  if (normRule.includes(normDesc) && normDesc.length > 3) return 0.7;

  // Word overlap scoring
  const ruleWords = normRule.split(" ").filter((w) => w.length > 2);
  const descWords = normDesc.split(" ").filter((w) => w.length > 2);
  if (ruleWords.length === 0) return 0;

  const matches = ruleWords.filter((w) => descWords.includes(w)).length;
  const score = matches / ruleWords.length;

  return score >= 0.5 ? score * 0.8 : 0;
}

/**
 * Find the best matching rule for a transaction.
 * Returns { rule, confidence } or null if no match above threshold.
 */
export function findBestMatch(transaction, rules, threshold = 0.6) {
  let bestRule = null;
  let bestScore = 0;

  for (const rule of rules) {
    const score = matchScore(rule.vendor_pattern, transaction.description);
    // Boost score slightly for rules with more hits (proven patterns)
    const boostedScore = Math.min(score + Math.log10(rule.hit_count + 1) * 0.05, 1.0);

    if (boostedScore > bestScore && boostedScore >= threshold) {
      bestScore = boostedScore;
      bestRule = rule;
    }
  }

  if (!bestRule) return null;
  return { rule: bestRule, confidence: bestScore };
}

/**
 * Auto-tag a batch of transactions against known rules.
 * Returns transactions with property_id, category, confidence filled in where matched.
 */
export function autoTagTransactions(transactions, rules) {
  return transactions.map((txn) => {
    const match = findBestMatch(txn, rules);
    if (!match) return { ...txn, status: "PENDING", confidence: 0 };

    return {
      ...txn,
      property_id: match.rule.property_id,
      category: match.rule.category,
      confidence: match.confidence,
      matched_rule_id: match.rule.id,
      status: "AUTO_TAGGED",
    };
  });
}

/**
 * Extract a vendor pattern from a transaction description.
 * Takes the first 3-4 meaningful words as the pattern.
 */
export function extractVendorPattern(description) {
  const words = normalizeDescription(description)
    .split(" ")
    .filter((w) => w.length > 2);
  return words.slice(0, 4).join(" ");
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/tagging.js
git commit -m "feat: add tagging engine with pattern matching and auto-tag logic"
```

---

### Task 3: CSV Import Hook

**Files:**
- Create: `src/hooks/useTransactionImport.js`

- [ ] **Step 1: Install Papa Parse**

Run: `npm install papaparse`

- [ ] **Step 2: Write the import hook**

```js
import { useState } from "react";
import Papa from "papaparse";
import { supabase } from "../lib/supabase";
import { autoTagTransactions } from "../lib/tagging";

/**
 * Aspire CSV columns (expected):
 * Date, Description, Amount (SGD), Reference, Category, Status
 *
 * We map: Date → transaction_date, Description → description,
 * Amount → amount (negate debits), Reference → reference
 */
function parseAspireRow(row) {
  const date = row["Date"] || row["Transaction Date"] || row["date"];
  const desc = row["Description"] || row["description"] || row["Narrative"] || "";
  const amountRaw = row["Amount"] || row["Amount (SGD)"] || row["amount"] || "0";
  const ref = row["Reference"] || row["reference"] || "";

  // Parse amount — Aspire may use negative for debits
  const amount = Math.abs(parseFloat(String(amountRaw).replace(/[^0-9.\-]/g, "")) || 0);

  // Parse date — handle DD/MM/YYYY or YYYY-MM-DD
  let parsedDate = date;
  if (date && date.includes("/")) {
    const parts = date.split("/");
    if (parts.length === 3) {
      // DD/MM/YYYY → YYYY-MM-DD
      parsedDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
  }

  return {
    transaction_date: parsedDate,
    description: desc.trim(),
    amount,
    reference: ref.trim(),
  };
}

export function useTransactionImport() {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(null); // { total, parsed, tagged }
  const [error, setError] = useState(null);

  async function importCsv(file) {
    setImporting(true);
    setError(null);
    setProgress({ total: 0, parsed: 0, tagged: 0 });

    try {
      // 1. Parse CSV
      const parseResult = await new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => resolve(results),
          error: (err) => reject(err),
        });
      });

      const rows = parseResult.data
        .map(parseAspireRow)
        .filter((r) => r.description && r.amount > 0);

      setProgress((p) => ({ ...p, total: rows.length, parsed: rows.length }));

      // 2. Create import batch
      const { data: batch, error: batchErr } = await supabase
        .from("import_batches")
        .insert({ filename: file.name, row_count: rows.length })
        .select()
        .single();

      if (batchErr) throw batchErr;

      // 3. Fetch existing tagging rules
      const { data: rules } = await supabase
        .from("tagging_rules")
        .select("*")
        .order("hit_count", { ascending: false });

      // 4. Auto-tag transactions
      const tagged = autoTagTransactions(rows, rules ?? []);
      const autoTaggedCount = tagged.filter((t) => t.status === "AUTO_TAGGED").length;

      setProgress((p) => ({ ...p, tagged: autoTaggedCount }));

      // 5. Insert into bank_transactions
      const toInsert = tagged.map((t) => ({
        import_batch_id: batch.id,
        transaction_date: t.transaction_date,
        description: t.description,
        amount: t.amount,
        reference: t.reference,
        property_id: t.property_id || null,
        category: t.category || null,
        status: t.status,
        confidence: t.confidence,
        matched_rule_id: t.matched_rule_id || null,
      }));

      // Insert in chunks of 50
      for (let i = 0; i < toInsert.length; i += 50) {
        const chunk = toInsert.slice(i, i + 50);
        const { error: insertErr } = await supabase
          .from("bank_transactions")
          .insert(chunk);
        if (insertErr) throw insertErr;
      }

      // 6. Update batch stats
      await supabase
        .from("import_batches")
        .update({
          auto_tagged_count: autoTaggedCount,
          status: "REVIEWING",
        })
        .eq("id", batch.id);

      setImporting(false);
      return { batchId: batch.id, total: rows.length, autoTagged: autoTaggedCount };
    } catch (err) {
      setError(err.message || "Import failed");
      setImporting(false);
      return null;
    }
  }

  return { importCsv, importing, progress, error };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useTransactionImport.js package.json package-lock.json
git commit -m "feat: add CSV import hook with Aspire format parsing and auto-tagging"
```

---

### Task 4: Transaction Review Hook

**Files:**
- Create: `src/hooks/useTransactionReview.js`

- [ ] **Step 1: Write the review hook**

```js
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { extractVendorPattern } from "../lib/tagging";

export function useTransactionReview(batchId) {
  const [transactions, setTransactions] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ pending: 0, autoTagged: 0, confirmed: 0 });

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const query = supabase
      .from("bank_transactions")
      .select("*")
      .order("transaction_date", { ascending: false });

    if (batchId) {
      query.eq("import_batch_id", batchId);
    } else {
      // Show all unconfirmed
      query.in("status", ["PENDING", "AUTO_TAGGED"]);
    }

    const { data } = await query;
    const txns = data ?? [];
    setTransactions(txns);
    setStats({
      pending: txns.filter((t) => t.status === "PENDING").length,
      autoTagged: txns.filter((t) => t.status === "AUTO_TAGGED").length,
      confirmed: txns.filter((t) => t.status === "CONFIRMED").length,
    });
    setLoading(false);
  }, [batchId]);

  const fetchProperties = useCallback(async () => {
    const { data } = await supabase
      .from("properties")
      .select("id, name, code")
      .order("name");
    setProperties(data ?? []);
  }, []);

  useEffect(() => {
    fetchTransactions();
    fetchProperties();
  }, [fetchTransactions, fetchProperties]);

  /**
   * Confirm a transaction's tag — saves to bank_transactions,
   * creates/updates a tagging rule, and converts to a property_expense.
   */
  async function confirmTag(transactionId, propertyId, category, month) {
    const txn = transactions.find((t) => t.id === transactionId);
    if (!txn) return;

    // 1. Update the transaction
    await supabase
      .from("bank_transactions")
      .update({
        property_id: propertyId,
        category,
        status: "CONFIRMED",
        confidence: 1.0,
      })
      .eq("id", transactionId);

    // 2. Upsert tagging rule (learn the pattern)
    const pattern = extractVendorPattern(txn.description);
    if (pattern) {
      const { data: existing } = await supabase
        .from("tagging_rules")
        .select("id, hit_count")
        .eq("vendor_pattern", pattern)
        .eq("property_id", propertyId)
        .eq("category", category)
        .single();

      if (existing) {
        await supabase
          .from("tagging_rules")
          .update({
            hit_count: existing.hit_count + 1,
            last_used_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("tagging_rules").insert({
          vendor_pattern: pattern,
          property_id: propertyId,
          category,
        });
      }
    }

    // 3. Create property_expense (feeds into existing financials)
    const expenseMonth = month || `${txn.transaction_date.slice(0, 7)}-01`;
    await supabase.from("property_expenses").insert({
      property_id: propertyId,
      month: expenseMonth,
      category,
      description: txn.description,
      amount: txn.amount,
      is_recurring: false,
    });

    // 4. Refresh
    fetchTransactions();
  }

  /**
   * Ignore a transaction (not an expense — e.g. internal transfer).
   */
  async function ignoreTransaction(transactionId) {
    await supabase
      .from("bank_transactions")
      .update({ status: "IGNORED" })
      .eq("id", transactionId);
    fetchTransactions();
  }

  /**
   * Bulk confirm all auto-tagged transactions with high confidence.
   */
  async function bulkConfirmAutoTagged(minConfidence = 0.85) {
    const highConfidence = transactions.filter(
      (t) => t.status === "AUTO_TAGGED" && t.confidence >= minConfidence
    );

    for (const txn of highConfidence) {
      await confirmTag(
        txn.id,
        txn.property_id,
        txn.category,
        `${txn.transaction_date.slice(0, 7)}-01`
      );
    }
  }

  return {
    transactions,
    properties,
    loading,
    stats,
    confirmTag,
    ignoreTransaction,
    bulkConfirmAutoTagged,
    refresh: fetchTransactions,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useTransactionReview.js
git commit -m "feat: add transaction review hook with confirm, ignore, and bulk-confirm"
```

---

### Task 5: CSV Upload Component

**Files:**
- Create: `src/components/portal/CsvUploader.jsx`

- [ ] **Step 1: Write the upload component**

```jsx
import { useRef, useState } from "react";

export default function CsvUploader({ onFileSelected, importing, progress }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".csv")) {
      onFileSelected(file);
    }
  }

  function handleChange(e) {
    const file = e.target.files[0];
    if (file) onFileSelected(file);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !importing && inputRef.current?.click()}
      className={`
        relative cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all
        ${dragOver
          ? "border-[#14b8a6] bg-[#14b8a6]/5"
          : "border-[#bbcac6]/30 bg-white hover:border-[#14b8a6]/50 hover:bg-[#f8f9ff]"
        }
        ${importing ? "pointer-events-none opacity-60" : ""}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        onChange={handleChange}
        className="hidden"
      />

      <span className="material-symbols-outlined text-[48px] text-[#bbcac6] mb-4 block">
        upload_file
      </span>

      {importing ? (
        <div className="space-y-2">
          <p className="font-['Manrope'] font-bold text-[#121c2a]">
            Importing...
          </p>
          {progress && (
            <p className="font-['Manrope'] text-sm text-[#6c7a77]">
              {progress.parsed} transactions parsed, {progress.tagged} auto-tagged
            </p>
          )}
          <div className="w-48 mx-auto h-1.5 bg-[#eff4ff] rounded-full overflow-hidden">
            <div className="h-full bg-[#006b5f] rounded-full animate-pulse w-2/3" />
          </div>
        </div>
      ) : (
        <>
          <p className="font-['Manrope'] font-bold text-[#121c2a] mb-1">
            Drop Aspire CSV here
          </p>
          <p className="font-['Manrope'] text-sm text-[#6c7a77]">
            or click to browse. We'll auto-tag what we recognize.
          </p>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/portal/CsvUploader.jsx
git commit -m "feat: add drag-drop CSV uploader component"
```

---

### Task 6: Drag-and-Drop Review Board

**Files:**
- Create: `src/components/portal/TransactionCard.jsx`
- Create: `src/components/portal/TransactionReviewBoard.jsx`

- [ ] **Step 1: Install dnd-kit**

Run: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

- [ ] **Step 2: Write TransactionCard**

```jsx
import { useDraggable } from "@dnd-kit/core";

const CATEGORY_BADGE = {
  MASTER_LEASE: "bg-blue-100 text-blue-700",
  UTILITIES: "bg-amber-100 text-amber-700",
  MAINTENANCE: "bg-orange-100 text-orange-700",
  CLEANING: "bg-[#d1fae5] text-[#065f46]",
  SUPPLIES: "bg-[#e6eeff] text-[#555f6f]",
  STAFF: "bg-violet-100 text-violet-700",
  PLATFORM_FEES: "bg-cyan-100 text-cyan-700",
  OTHER: "bg-[#eff4ff] text-[#6c7a77]",
};

function formatSGD(amount) {
  return `$${Number(amount).toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function TransactionCard({ transaction, onIgnore }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: transaction.id, data: transaction });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  const badge = CATEGORY_BADGE[transaction.category] ?? CATEGORY_BADGE.OTHER;
  const isAutoTagged = transaction.status === "AUTO_TAGGED";
  const confidencePct = Math.round((transaction.confidence ?? 0) * 100);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        bg-white rounded-xl border p-4 cursor-grab active:cursor-grabbing transition-shadow
        ${isDragging ? "shadow-lg border-[#14b8a6] opacity-80 z-50" : "border-[#bbcac6]/15 shadow-sm hover:shadow-md"}
      `}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-['Manrope'] text-sm font-medium text-[#121c2a] leading-tight line-clamp-2">
          {transaction.description}
        </p>
        <span className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#121c2a] shrink-0 tabular-nums">
          {formatSGD(transaction.amount)}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-['Manrope'] text-xs text-[#bbcac6]">
          {transaction.transaction_date}
        </span>

        {transaction.category && (
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest ${badge}`}>
            {transaction.category}
          </span>
        )}

        {isAutoTagged && (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-[#14b8a6]/10 text-[#006b5f]">
            {confidencePct}% match
          </span>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 mt-3 pt-2 border-t border-[#bbcac6]/10">
        {isAutoTagged && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              // Will be handled by parent — confirm as-is
            }}
            className="text-[10px] font-bold font-['Inter'] uppercase tracking-widest text-[#006b5f] hover:underline"
          >
            Confirm
          </button>
        )}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onIgnore(transaction.id);
          }}
          className="text-[10px] font-bold font-['Inter'] uppercase tracking-widest text-[#bbcac6] hover:text-[#ba1a1a]"
        >
          Ignore
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write TransactionReviewBoard**

```jsx
import { useState } from "react";
import { DndContext, DragOverlay, pointerWithin } from "@dnd-kit/core";
import TransactionCard from "./TransactionCard";

const EXPENSE_CATEGORIES = [
  "MASTER_LEASE",
  "UTILITIES",
  "MAINTENANCE",
  "CLEANING",
  "SUPPLIES",
  "STAFF",
  "PLATFORM_FEES",
  "OTHER",
];

const CATEGORY_COLOR = {
  MASTER_LEASE: "border-blue-300 bg-blue-50/50",
  UTILITIES: "border-amber-300 bg-amber-50/50",
  MAINTENANCE: "border-orange-300 bg-orange-50/50",
  CLEANING: "border-emerald-300 bg-emerald-50/50",
  SUPPLIES: "border-slate-300 bg-slate-50/50",
  STAFF: "border-violet-300 bg-violet-50/50",
  PLATFORM_FEES: "border-cyan-300 bg-cyan-50/50",
  OTHER: "border-gray-300 bg-gray-50/50",
};

export default function TransactionReviewBoard({
  transactions,
  properties,
  onConfirm,
  onIgnore,
  onBulkConfirm,
  stats,
}) {
  const [activeTransaction, setActiveTransaction] = useState(null);
  const [selectedProperty, setSelectedProperty] = useState(
    properties[0]?.id ?? ""
  );

  const pending = transactions.filter(
    (t) => t.status === "PENDING" || t.status === "AUTO_TAGGED"
  );

  function handleDragStart(event) {
    const txn = event.active.data.current;
    setActiveTransaction(txn);
  }

  function handleDragEnd(event) {
    setActiveTransaction(null);
    const { active, over } = event;
    if (!over) return;

    const txnId = active.id;
    const category = over.id; // droppable id = category name
    const txn = transactions.find((t) => t.id === txnId);
    if (!txn || !selectedProperty) return;

    const month = `${txn.transaction_date.slice(0, 7)}-01`;
    onConfirm(txnId, selectedProperty, category, month);
  }

  return (
    <div className="space-y-6">
      {/* Controls bar */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <label className="font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold">
            Tag to property:
          </label>
          <select
            value={selectedProperty}
            onChange={(e) => setSelectedProperty(e.target.value)}
            className="bg-[#eff4ff] border-0 rounded-xl px-4 py-2.5 font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none text-sm"
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-['Manrope'] text-sm text-[#6c7a77]">
            {stats.pending} pending · {stats.autoTagged} auto-tagged
          </span>
          {stats.autoTagged > 0 && (
            <button
              onClick={onBulkConfirm}
              className="px-4 py-2 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:opacity-90 transition-all"
            >
              Confirm All High-Confidence
            </button>
          )}
        </div>
      </div>

      <DndContext
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: untagged transactions */}
          <div className="lg:col-span-4 space-y-3">
            <h3 className="font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-2">
              Transactions to Review ({pending.length})
            </h3>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {pending.map((txn) => (
                <TransactionCard
                  key={txn.id}
                  transaction={txn}
                  onIgnore={onIgnore}
                />
              ))}
              {pending.length === 0 && (
                <div className="text-center py-8">
                  <span className="material-symbols-outlined text-[48px] text-[#d1fae5] mb-2 block">
                    check_circle
                  </span>
                  <p className="font-['Manrope'] text-sm text-[#6c7a77]">
                    All transactions reviewed!
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right: category drop zones */}
          <div className="lg:col-span-8">
            <h3 className="font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-2">
              Drag to Category
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {EXPENSE_CATEGORIES.map((cat) => {
                const color = CATEGORY_COLOR[cat] ?? CATEGORY_COLOR.OTHER;
                return (
                  <CategoryDropZone key={cat} id={cat} color={color}>
                    {cat.replace(/_/g, " ")}
                  </CategoryDropZone>
                );
              })}
            </div>
          </div>
        </div>

        <DragOverlay>
          {activeTransaction && (
            <div className="bg-white rounded-xl border border-[#14b8a6] shadow-xl p-4 w-64 opacity-90">
              <p className="font-['Manrope'] text-sm font-medium text-[#121c2a] line-clamp-1">
                {activeTransaction.description}
              </p>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#006b5f] mt-1">
                ${Number(activeTransaction.amount).toFixed(2)}
              </p>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function CategoryDropZone({ id, color, children }) {
  // Using useDroppable from dnd-kit
  const { useDroppable } = require("@dnd-kit/core");
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`
        rounded-xl border-2 p-6 text-center transition-all min-h-[100px] flex items-center justify-center
        ${color}
        ${isOver ? "scale-105 border-[#14b8a6] shadow-lg" : ""}
      `}
    >
      <span className="font-['Inter'] text-[10px] uppercase tracking-widest font-bold text-[#555f6f]">
        {children}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/portal/TransactionCard.jsx src/components/portal/TransactionReviewBoard.jsx package.json package-lock.json
git commit -m "feat: add drag-and-drop transaction review board with category drop zones"
```

---

### Task 7: Admin Expense Import Page

**Files:**
- Create: `src/pages/portal/AdminExpenseImportPage.jsx`
- Modify: `src/App.jsx` (add route)

- [ ] **Step 1: Write the page**

```jsx
import { useState } from "react";
import PortalLayout from "../../components/portal/PortalLayout";
import CsvUploader from "../../components/portal/CsvUploader";
import TransactionReviewBoard from "../../components/portal/TransactionReviewBoard";
import { useTransactionImport } from "../../hooks/useTransactionImport";
import { useTransactionReview } from "../../hooks/useTransactionReview";

export default function AdminExpenseImportPage() {
  const [batchId, setBatchId] = useState(null);
  const { importCsv, importing, progress, error: importError } = useTransactionImport();
  const {
    transactions,
    properties,
    loading,
    stats,
    confirmTag,
    ignoreTransaction,
    bulkConfirmAutoTagged,
    refresh,
  } = useTransactionReview(batchId);

  async function handleFileSelected(file) {
    const result = await importCsv(file);
    if (result) {
      setBatchId(result.batchId);
    }
  }

  return (
    <PortalLayout>
      <div className="mb-10">
        <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a] tracking-tight">
          Import Expenses
        </h1>
        <p className="text-[#6c7a77] font-['Manrope'] font-medium mt-1">
          Upload your Aspire CSV. We'll auto-tag what we recognize — you confirm the rest.
        </p>
      </div>

      {/* Upload section */}
      <div className="mb-8">
        <CsvUploader
          onFileSelected={handleFileSelected}
          importing={importing}
          progress={progress}
        />
        {importError && (
          <p className="mt-3 font-['Manrope'] text-sm text-[#ba1a1a]">
            {importError}
          </p>
        )}
      </div>

      {/* Import summary */}
      {progress && !importing && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm">
            <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-3">
              Imported
            </p>
            <p className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a]">
              {progress.total}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm">
            <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-3">
              Auto-Tagged
            </p>
            <p className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#006b5f]">
              {progress.tagged}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm">
            <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-3">
              Needs Review
            </p>
            <p className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-amber-600">
              {progress.total - progress.tagged}
            </p>
          </div>
        </div>
      )}

      {/* Review board */}
      {(transactions.length > 0 || batchId) && !loading && (
        <TransactionReviewBoard
          transactions={transactions}
          properties={properties}
          onConfirm={confirmTag}
          onIgnore={ignoreTransaction}
          onBulkConfirm={bulkConfirmAutoTagged}
          stats={stats}
        />
      )}

      {loading && batchId && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 border-2 border-[#006b5f] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </PortalLayout>
  );
}
```

- [ ] **Step 2: Add route to App.jsx**

Find the admin routes section in `src/App.jsx` and add:

```jsx
<Route path="expenses/import" element={<AdminExpenseImportPage />} />
```

Add the import at the top:

```jsx
import AdminExpenseImportPage from "./pages/portal/AdminExpenseImportPage";
```

- [ ] **Step 3: Add nav link in PortalLayout.jsx**

Find the admin navigation section in `src/components/portal/PortalLayout.jsx` and add a link to the import page next to the existing Expenses link:

```jsx
{ to: "/portal/expenses/import", icon: "upload_file", label: "Import" },
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/portal/AdminExpenseImportPage.jsx src/App.jsx src/components/portal/PortalLayout.jsx
git commit -m "feat: add expense import page with CSV upload, auto-tag summary, and review board"
```

---

### Task 8: Fix CategoryDropZone Import & Polish

**Files:**
- Modify: `src/components/portal/TransactionReviewBoard.jsx`

- [ ] **Step 1: Fix the useDroppable import**

The `CategoryDropZone` component uses a `require()` inside the function body which won't work with ESM. Fix it by importing at the top level:

Move `useDroppable` to the top of `TransactionReviewBoard.jsx`:

```jsx
import { DndContext, DragOverlay, pointerWithin, useDroppable } from "@dnd-kit/core";
```

Then update `CategoryDropZone` to remove the require:

```jsx
function CategoryDropZone({ id, color, children }) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`
        rounded-xl border-2 p-6 text-center transition-all min-h-[100px] flex items-center justify-center
        ${color}
        ${isOver ? "scale-105 border-[#14b8a6] shadow-lg" : ""}
      `}
    >
      <span className="font-['Inter'] text-[10px] uppercase tracking-widest font-bold text-[#555f6f]">
        {children}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Add confirm handler to TransactionCard**

Update `TransactionCard.jsx` to accept an `onConfirm` prop and wire up the Confirm button:

```jsx
export default function TransactionCard({ transaction, onIgnore, onConfirm }) {
```

Update the confirm button:

```jsx
{isAutoTagged && (
  <button
    onPointerDown={(e) => e.stopPropagation()}
    onClick={(e) => {
      e.stopPropagation();
      if (onConfirm) onConfirm(transaction.id);
    }}
    className="text-[10px] font-bold font-['Inter'] uppercase tracking-widest text-[#006b5f] hover:underline"
  >
    Confirm
  </button>
)}
```

- [ ] **Step 3: Wire onConfirm in TransactionReviewBoard**

Pass a quick-confirm handler for auto-tagged items:

```jsx
{pending.map((txn) => (
  <TransactionCard
    key={txn.id}
    transaction={txn}
    onIgnore={onIgnore}
    onConfirm={
      txn.status === "AUTO_TAGGED" && txn.property_id && txn.category
        ? (id) => onConfirm(id, txn.property_id, txn.category, `${txn.transaction_date.slice(0, 7)}-01`)
        : undefined
    }
  />
))}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/portal/TransactionReviewBoard.jsx src/components/portal/TransactionCard.jsx
git commit -m "fix: ESM import for useDroppable, wire up confirm handler on TransactionCard"
```

---

### Task 9: Integration Test — End-to-End Flow

**Files:**
- No new files — manual testing

- [ ] **Step 1: Export a test CSV from Aspire**

Log into Aspire, go to Transactions, export as CSV for the current month. Note the column headers.

- [ ] **Step 2: Verify CSV parsing**

Open the app locally (`npm run dev`), go to `/portal/expenses/import`, upload the CSV. Check:
- All rows parsed correctly (correct amounts, dates, descriptions)
- If column headers don't match, update `parseAspireRow` in `useTransactionImport.js`

- [ ] **Step 3: Tag a few transactions manually**

Drag 3-4 transactions to categories. Verify:
- They disappear from the pending list
- They appear in `property_expenses` table (check via existing Expenses page)
- A `tagging_rules` entry was created for each

- [ ] **Step 4: Upload the same CSV again (or next month's)**

Verify that previously-tagged vendor patterns are now auto-tagged. Check confidence scores.

- [ ] **Step 5: Test bulk confirm**

Click "Confirm All High-Confidence". Verify all auto-tagged items with ≥85% confidence are confirmed and appear in expenses.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: CSV column mapping adjustments for Aspire export format"
```

---

## Future: Aspire API Integration (When Access Granted)

When Aspire provides API credentials, create a Supabase Edge Function:

```
supabase/functions/aspire-sync/index.ts
```

This function will:
1. Call Aspire Bank Feed API to fetch new transactions since last sync
2. Insert into `bank_transactions` with a new `import_batch`
3. Run auto-tagging
4. Can be triggered manually from the portal or on a daily cron

The review UI stays exactly the same — only the import source changes from CSV to API.

---

## Future: Smart Lock Viewing Flow (Separate Plan)

Self-service viewing links with one-time smart lock codes — to be planned as a separate feature once locks are installed mid-April.
