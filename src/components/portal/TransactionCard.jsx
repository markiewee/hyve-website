import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

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

export default function TransactionCard({ transaction, onIgnore, onConfirm }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: transaction.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    touchAction: "none",
  };

  const isAutoTagged = transaction.status === "AUTO_TAGGED";
  const badgeClass =
    CATEGORY_BADGE[transaction.suggested_category] || CATEGORY_BADGE.OTHER;
  const categoryLabel =
    CATEGORY_LABELS[transaction.suggested_category] || transaction.suggested_category;

  const formattedAmount = new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    minimumFractionDigits: 2,
  }).format(Math.abs(transaction.amount ?? 0));

  const formattedDate = transaction.transaction_date
    ? new Date(transaction.transaction_date).toLocaleDateString("en-MY", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="rounded-xl border border-[#bbcac6]/20 bg-white p-3 shadow-sm cursor-grab active:cursor-grabbing select-none"
    >
      {/* Description + Amount */}
      <div className="flex items-start justify-between gap-2">
        <p
          style={{ fontFamily: "'Manrope', sans-serif" }}
          className="text-xs text-[#1a2e2b] font-medium line-clamp-2 flex-1"
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

      {/* Date */}
      <p
        style={{ fontFamily: "'Inter', sans-serif" }}
        className="mt-1 text-[11px] text-[#6c7a77]"
      >
        {formattedDate}
      </p>

      {/* Badges */}
      {(isAutoTagged && transaction.suggested_category) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClass}`}
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            {categoryLabel}
          </span>
          {transaction.confidence != null && (
            <span
              className="inline-flex items-center rounded-full bg-[#f0fdf4] text-[#16a34a] px-2 py-0.5 text-[10px] font-semibold"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              {Math.round(transaction.confidence * 100)}% match
            </span>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-2.5 flex items-center gap-1.5">
        {isAutoTagged && onConfirm && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onConfirm(transaction.id);
            }}
            className="flex-1 rounded-lg bg-[#006b5f] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[#005a50] transition-colors"
            style={{ fontFamily: "'Inter', sans-serif" }}
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
          className="flex-1 rounded-lg border border-[#bbcac6]/40 px-2 py-1 text-[11px] font-semibold text-[#6c7a77] hover:bg-[#f5f8f7] transition-colors"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          Ignore
        </button>
      </div>
    </div>
  );
}
