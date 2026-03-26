const CATEGORY_BADGE = "bg-secondary text-secondary-foreground";

const STATUS_CONFIG = {
  OPEN: { label: "Open", class: "bg-red-100 text-red-700" },
  IN_PROGRESS: { label: "In Progress", class: "bg-yellow-100 text-yellow-700" },
  ESCALATED: { label: "Escalated", class: "bg-orange-100 text-orange-700" },
  RESOLVED: { label: "Resolved", class: "bg-green-100 text-green-700" },
};

export default function TicketCard({ ticket, onAction }) {
  const {
    id,
    category,
    status = "OPEN",
    description,
    resolution_note,
    ticket_photos = [],
    rooms,
    created_at,
  } = ticket;

  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.OPEN;
  const unitCode = rooms?.unit_code;
  const dateStr = created_at ? new Date(created_at).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" }) : "";

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-card">
      {/* Header row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Category badge */}
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_BADGE}`}
        >
          {category}
        </span>

        {/* Status badge */}
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusCfg.class}`}
        >
          {statusCfg.label}
        </span>

        {/* Date + Unit code */}
        <span className="text-xs text-muted-foreground ml-auto flex items-center gap-2">
          {dateStr}
          {unitCode && (
            <span className="font-mono bg-muted px-2 py-0.5 rounded">
              {unitCode}
            </span>
          )}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-foreground leading-relaxed">{description}</p>

      {/* Photo thumbnails */}
      {ticket_photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {ticket_photos.map((photo) => (
            <a
              key={photo.id}
              href={photo.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={photo.url}
                alt="Ticket photo"
                className="h-16 w-16 object-cover rounded"
              />
            </a>
          ))}
        </div>
      )}

      {/* Resolution note */}
      {resolution_note && (
        <div className="bg-green-50 border border-green-200 rounded p-3">
          <p className="text-xs font-medium text-green-700 mb-0.5">Resolution</p>
          <p className="text-sm text-green-800">{resolution_note}</p>
        </div>
      )}

      {/* Action buttons (captain/admin) */}
      {onAction && (
        <div className="flex flex-wrap gap-2 pt-1">
          {(status === "OPEN" || status === "ESCALATED") && (
            <button
              type="button"
              onClick={() => onAction(id, "assign")}
              className="px-3 py-1 rounded text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
            >
              Assign to me
            </button>
          )}
          {(status === "OPEN" || status === "IN_PROGRESS") && (
            <button
              type="button"
              onClick={() => onAction(id, "escalate")}
              className="px-3 py-1 rounded text-xs font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors"
            >
              Escalate
            </button>
          )}
          {status !== "RESOLVED" && (
            <button
              type="button"
              onClick={() => onAction(id, "resolve")}
              className="px-3 py-1 rounded text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
            >
              Resolve
            </button>
          )}
        </div>
      )}
    </div>
  );
}
