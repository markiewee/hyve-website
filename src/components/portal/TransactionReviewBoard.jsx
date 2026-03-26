import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  useDroppable,
} from "@dnd-kit/core";
import TransactionCard from "./TransactionCard";

const CATEGORIES = [
  "MASTER_LEASE",
  "UTILITIES",
  "MAINTENANCE",
  "CLEANING",
  "SUPPLIES",
  "STAFF",
  "PLATFORM_FEES",
  "OTHER",
];

const CATEGORY_LABELS = {
  MASTER_LEASE: "Master Lease",
  UTILITIES: "Utilities",
  MAINTENANCE: "Maintenance",
  CLEANING: "Cleaning",
  SUPPLIES: "Supplies",
  STAFF: "Staff",
  PLATFORM_FEES: "Platform Fees",
  OTHER: "Other",
};

const CATEGORY_ICONS = {
  MASTER_LEASE: "home",
  UTILITIES: "bolt",
  MAINTENANCE: "build",
  CLEANING: "mop",
  SUPPLIES: "inventory_2",
  STAFF: "badge",
  PLATFORM_FEES: "devices",
  OTHER: "more_horiz",
};

function DropZone({ category, isActiveOver }) {
  const { setNodeRef, isOver } = useDroppable({ id: category });
  const active = isOver || isActiveOver;

  return (
    <div
      ref={setNodeRef}
      className={[
        "flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-4 transition-all duration-150 min-h-[90px]",
        active
          ? "border-[#14b8a6] bg-[#14b8a6]/5 scale-105 shadow-sm"
          : "border-[#bbcac6]/30 bg-white hover:border-[#bbcac6]/60",
      ].join(" ")}
    >
      <span
        className={`material-symbols-outlined text-xl ${
          active ? "text-[#14b8a6]" : "text-[#6c7a77]"
        }`}
      >
        {CATEGORY_ICONS[category]}
      </span>
      <span
        style={{ fontFamily: "'Inter', sans-serif" }}
        className={`text-[11px] font-semibold text-center leading-tight ${
          active ? "text-[#006b5f]" : "text-[#6c7a77]"
        }`}
      >
        {CATEGORY_LABELS[category]}
      </span>
    </div>
  );
}

function MiniCard({ transaction }) {
  const formattedAmount = new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
  }).format(Math.abs(transaction.amount ?? 0));

  return (
    <div className="rounded-xl border border-[#bbcac6]/20 bg-white px-3 py-2.5 shadow-lg w-64">
      <div className="flex items-start justify-between gap-2">
        <p
          style={{ fontFamily: "'Manrope', sans-serif" }}
          className="text-xs text-[#1a2e2b] font-medium line-clamp-1 flex-1"
        >
          {transaction.description}
        </p>
        <span
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          className="text-xs font-bold text-[#1a2e2b] whitespace-nowrap"
        >
          {formattedAmount}
        </span>
      </div>
    </div>
  );
}

export default function TransactionReviewBoard({
  transactions = [],
  properties = [],
  onConfirm,
  onIgnore,
  onBulkConfirm,
  stats,
}) {
  const [selectedPropertyId, setSelectedPropertyId] = useState(
    properties[0]?.id ?? ""
  );
  const [activeTxn, setActiveTxn] = useState(null);
  const [activeCategoryOver, setActiveCategoryOver] = useState(null);

  const reviewable = transactions.filter(
    (t) => t.status === "PENDING" || t.status === "AUTO_TAGGED"
  );

  const pendingCount = stats?.pending ?? transactions.filter((t) => t.status === "PENDING").length;
  const autoTaggedCount =
    stats?.auto_tagged ?? transactions.filter((t) => t.status === "AUTO_TAGGED").length;

  const handleDragStart = (event) => {
    const txn = transactions.find((t) => t.id === event.active.id);
    setActiveTxn(txn ?? null);
    setActiveCategoryOver(null);
  };

  const handleDragOver = (event) => {
    setActiveCategoryOver(event.over?.id ?? null);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveTxn(null);
    setActiveCategoryOver(null);

    if (!over || !CATEGORIES.includes(over.id)) return;

    const txn = transactions.find((t) => t.id === active.id);
    if (!txn) return;

    const month = txn.transaction_date
      ? txn.transaction_date.slice(0, 7) // "YYYY-MM"
      : null;

    onConfirm(txn.id, selectedPropertyId, over.id, month);
  };

  if (reviewable.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <span className="material-symbols-outlined text-5xl text-[#006b5f]">
          check_circle
        </span>
        <p
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          className="text-base font-semibold text-[#1a2e2b]"
        >
          All transactions reviewed!
        </p>
        <p
          style={{ fontFamily: "'Manrope', sans-serif" }}
          className="text-sm text-[#6c7a77]"
        >
          Nothing left to confirm or ignore.
        </p>
      </div>
    );
  }

  return (
    <DndContext
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {/* Controls bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Property selector */}
        <select
          value={selectedPropertyId}
          onChange={(e) => setSelectedPropertyId(e.target.value)}
          className="rounded-lg border border-[#bbcac6]/30 bg-white px-3 py-1.5 text-xs text-[#1a2e2b] focus:outline-none focus:ring-2 focus:ring-[#006b5f]/30"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name ?? p.id}
            </option>
          ))}
        </select>

        {/* Stats */}
        <span
          style={{ fontFamily: "'Manrope', sans-serif" }}
          className="text-xs text-[#6c7a77] flex-1"
        >
          {pendingCount} pending · {autoTaggedCount} auto-tagged
        </span>

        {/* Bulk confirm */}
        {autoTaggedCount > 0 && (
          <button
            onClick={onBulkConfirm}
            className="rounded-lg bg-[#006b5f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#005a50] transition-colors"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Confirm All High-Confidence
          </button>
        )}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left: transactions list */}
        <div className="col-span-4">
          <p
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            className="mb-2.5 text-xs font-semibold text-[#1a2e2b] uppercase tracking-wide"
          >
            Transactions to Review
          </p>
          <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-1">
            {reviewable.map((txn) => (
              <TransactionCard
                key={txn.id}
                transaction={txn}
                onIgnore={onIgnore}
                onConfirm={txn.status === "AUTO_TAGGED" && txn.property_id && txn.category ? (() => {
                  const month = txn.transaction_date ? `${txn.transaction_date.slice(0, 7)}-01` : null;
                  onConfirm(txn.id, txn.property_id, txn.category, month);
                }) : undefined}
              />
            ))}
          </div>
        </div>

        {/* Right: drop zones */}
        <div className="col-span-8">
          <p
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            className="mb-2.5 text-xs font-semibold text-[#1a2e2b] uppercase tracking-wide"
          >
            Drag to Category
          </p>
          <div className="grid grid-cols-4 gap-2.5">
            {CATEGORIES.map((cat) => (
              <DropZone
                key={cat}
                category={cat}
                isActiveOver={activeCategoryOver === cat}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeTxn ? <MiniCard transaction={activeTxn} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
