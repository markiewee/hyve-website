import { useState, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  useDroppable,
} from "@dnd-kit/core";
import TransactionCard from "./TransactionCard";

const EXPENSE_CATEGORIES = [
  "MASTER_LEASE",
  "UTILITIES",
  "MAINTENANCE",
  "CLEANING",
  "SUPPLIES",
  "WIFI",
  "INSURANCE",
  "STAFF",
  "PLATFORM_FEES",
  "FURNISHING",
  "MARKETING",
  "OTHER_EXPENSE",
];

const INCOME_CATEGORIES = [
  "RENT",
  "DEPOSIT_IN",
  "AC_SURCHARGE",
  "ADHOC_FEE",
  "STRIPE_PAYOUT",
  "OTHER_INCOME",
];

const ALL_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];

const CATEGORY_LABELS = {
  MASTER_LEASE: "Master Lease",
  UTILITIES: "Utilities",
  MAINTENANCE: "Maintenance",
  CLEANING: "Cleaning",
  SUPPLIES: "Supplies",
  WIFI: "WiFi",
  INSURANCE: "Insurance",
  STAFF: "Staff",
  PLATFORM_FEES: "Platform Fees",
  FURNISHING: "Furnishing",
  MARKETING: "Marketing",
  OTHER_EXPENSE: "Other Expense",
  RENT: "Rent",
  DEPOSIT_IN: "Deposit In",
  AC_SURCHARGE: "AC Surcharge",
  ADHOC_FEE: "Ad-hoc Fee",
  STRIPE_PAYOUT: "Stripe Payout",
  OTHER_INCOME: "Other Income",
  OTHER: "Other",
};

const CATEGORY_ICONS = {
  MASTER_LEASE: "home",
  UTILITIES: "bolt",
  MAINTENANCE: "build",
  CLEANING: "mop",
  SUPPLIES: "inventory_2",
  WIFI: "wifi",
  INSURANCE: "shield",
  STAFF: "badge",
  PLATFORM_FEES: "devices",
  FURNISHING: "chair",
  MARKETING: "campaign",
  OTHER_EXPENSE: "more_horiz",
  RENT: "payments",
  DEPOSIT_IN: "account_balance",
  AC_SURCHARGE: "ac_unit",
  ADHOC_FEE: "receipt",
  STRIPE_PAYOUT: "credit_card",
  OTHER_INCOME: "add_circle",
  OTHER: "more_horiz",
};

function formatSGD(amount) {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    minimumFractionDigits: 2,
  }).format(amount ?? 0);
}

function DropZone({ category, isActiveOver, isIncome }) {
  const { setNodeRef, isOver } = useDroppable({ id: category });
  const active = isOver || isActiveOver;
  const accentColor = isIncome ? "#16a34a" : "#14b8a6";

  return (
    <div
      ref={setNodeRef}
      className={[
        "flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-4 transition-all duration-150 min-h-[90px]",
        active
          ? `border-[${accentColor}] bg-[${accentColor}]/5 scale-105 shadow-sm`
          : "border-[#bbcac6]/30 bg-white hover:border-[#bbcac6]/60",
      ].join(" ")}
      style={active ? { borderColor: accentColor, backgroundColor: `${accentColor}10` } : {}}
    >
      <span
        className={`material-symbols-outlined text-xl ${
          active ? "" : "text-[#6c7a77]"
        }`}
        style={active ? { color: accentColor } : {}}
      >
        {CATEGORY_ICONS[category] ?? "more_horiz"}
      </span>
      <span
        style={{ fontFamily: "'Inter', sans-serif" }}
        className={`text-[11px] font-semibold text-center leading-tight ${
          active ? "text-[#006b5f]" : "text-[#6c7a77]"
        }`}
      >
        {CATEGORY_LABELS[category] ?? category}
      </span>
    </div>
  );
}

function MiniCard({ transaction }) {
  const isIncome = transaction.transaction_type === "INCOME";
  const amt = Math.abs(transaction.amount ?? 0);

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
          className={`text-xs font-bold whitespace-nowrap ${isIncome ? "text-[#16a34a]" : "text-[#ba1a1a]"}`}
        >
          {isIncome ? "+" : "-"}{formatSGD(amt).replace("SGD", "").trim()}
        </span>
      </div>
    </div>
  );
}

const TYPE_TABS = [
  { id: "ALL", label: "All" },
  { id: "INCOME", label: "Income" },
  { id: "EXPENSE", label: "Expense" },
];

export default function TransactionReviewBoard({
  transactions = [],
  properties = [],
  rooms = [],
  onConfirm,
  onIgnore,
  onBulkConfirm,
  onAssignRoom,
  stats,
  typeFilter = "ALL",
  onTypeFilterChange,
}) {
  const [selectedPropertyId, setSelectedPropertyId] = useState(
    properties[0]?.id ?? ""
  );
  const [activeTxn, setActiveTxn] = useState(null);
  const [activeCategoryOver, setActiveCategoryOver] = useState(null);
  const [roomSelections, setRoomSelections] = useState({});

  useEffect(() => {
    if (properties.length > 0 && !selectedPropertyId) {
      setSelectedPropertyId(properties[0].id);
    }
  }, [properties, selectedPropertyId]);

  const reviewable = transactions.filter(
    (t) => t.status === "PENDING" || t.status === "AUTO_TAGGED"
  );

  const pendingCount = stats?.pending ?? transactions.filter((t) => t.status === "PENDING").length;
  const autoTaggedCount =
    stats?.autoTagged ?? transactions.filter((t) => t.status === "AUTO_TAGGED").length;

  // Determine which categories to show based on type filter
  const activeCategories =
    typeFilter === "INCOME"
      ? INCOME_CATEGORIES
      : typeFilter === "EXPENSE"
      ? EXPENSE_CATEGORIES
      : ALL_CATEGORIES;

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

    if (!over || !activeCategories.includes(over.id)) return;

    const txn = transactions.find((t) => t.id === active.id);
    if (!txn) return;

    const month = txn.transaction_date
      ? txn.transaction_date.slice(0, 7)
      : null;

    const isIncomeCategory = INCOME_CATEGORIES.includes(over.id);
    const txType = isIncomeCategory ? "INCOME" : "EXPENSE";
    const roomId = roomSelections[txn.id] || null;

    onConfirm(txn.id, selectedPropertyId, over.id, month, {
      transaction_type: txType,
      room_id: roomId,
    });
  };

  const handleRoomChange = (txnId, roomId) => {
    setRoomSelections((prev) => ({ ...prev, [txnId]: roomId }));
    if (onAssignRoom) onAssignRoom(txnId, roomId);
  };

  // Rooms filtered by selected property
  const filteredRooms = rooms.filter(
    (r) => r.property_id === selectedPropertyId
  );

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
      {/* Type filter tabs */}
      <div className="mb-4 flex gap-1 bg-[#eff4ff] rounded-xl p-1 w-fit">
        {TYPE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTypeFilterChange?.(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-['Manrope'] font-semibold transition-all duration-150 ${
              typeFilter === tab.id
                ? "bg-white text-[#006b5f] shadow-sm"
                : "text-[#6c7a77] hover:text-[#121c2a]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

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
            {reviewable.map((txn) => {
              const isIncome = txn.transaction_type === "INCOME";
              const amt = Math.abs(txn.amount ?? 0);
              return (
                <div key={txn.id}>
                  <TransactionCard
                    transaction={txn}
                    onIgnore={onIgnore}
                    formatAmount={() => (
                      <span className={isIncome ? "text-[#16a34a]" : "text-[#ba1a1a]"}>
                        {isIncome ? "+" : "-"}{formatSGD(amt).replace("SGD", "").trim()}
                      </span>
                    )}
                    onConfirm={
                      txn.status === "AUTO_TAGGED" && txn.property_id && txn.category
                        ? () => {
                            const month = txn.transaction_date
                              ? `${txn.transaction_date.slice(0, 7)}-01`
                              : null;
                            onConfirm(txn.id, txn.property_id, txn.category, month, {
                              transaction_type: txn.transaction_type,
                              room_id: roomSelections[txn.id] || null,
                            });
                          }
                        : undefined
                    }
                  />
                  {/* Room selector */}
                  {filteredRooms.length > 0 && (
                    <select
                      value={roomSelections[txn.id] ?? txn.room_id ?? ""}
                      onChange={(e) => handleRoomChange(txn.id, e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#bbcac6]/20 bg-[#f8f9ff] px-2 py-1 text-[10px] text-[#6c7a77] focus:outline-none"
                      style={{ fontFamily: "'Inter', sans-serif" }}
                    >
                      <option value="">No room</option>
                      {filteredRooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: drop zones */}
        <div className="col-span-8">
          {typeFilter !== "EXPENSE" && (
            <>
              <p
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                className="mb-2.5 text-xs font-semibold text-[#16a34a] uppercase tracking-wide"
              >
                Income Categories
              </p>
              <div className="grid grid-cols-3 gap-2.5 mb-4">
                {INCOME_CATEGORIES.map((cat) => (
                  <DropZone
                    key={cat}
                    category={cat}
                    isActiveOver={activeCategoryOver === cat}
                    isIncome
                  />
                ))}
              </div>
            </>
          )}
          {typeFilter !== "INCOME" && (
            <>
              <p
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                className="mb-2.5 text-xs font-semibold text-[#ba1a1a] uppercase tracking-wide"
              >
                Expense Categories
              </p>
              <div className="grid grid-cols-4 gap-2.5">
                {EXPENSE_CATEGORIES.map((cat) => (
                  <DropZone
                    key={cat}
                    category={cat}
                    isActiveOver={activeCategoryOver === cat}
                    isIncome={false}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeTxn ? <MiniCard transaction={activeTxn} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
