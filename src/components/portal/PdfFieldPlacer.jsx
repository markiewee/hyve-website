import { useState, useRef, useCallback, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const RENDER_WIDTH = 612;

const FIELD_TYPES = [
  { key: "TENANT_NAME", label: "Member Name", color: "#3b82f6" },
  { key: "ID_NUMBER", label: "ID Number", color: "#8b5cf6" },
  { key: "PHONE", label: "Phone", color: "#06b6d4" },
  { key: "ROOM_CODE", label: "Room", color: "#10b981" },
  { key: "PROPERTY_NAME", label: "Property", color: "#f59e0b" },
  { key: "PROPERTY_ADDRESS", label: "Address", color: "#ef4444" },
  { key: "MONTHLY_RENT", label: "Rent", color: "#ec4899" },
  { key: "DEPOSIT_AMOUNT", label: "Deposit", color: "#f97316" },
  { key: "LICENCE_PERIOD", label: "Licence Period", color: "#14b8a6" },
  { key: "START_DATE", label: "Start Date", color: "#6366f1" },
  { key: "END_DATE", label: "End Date", color: "#a855f7" },
  { key: "REF_NUMBER", label: "Ref Number", color: "#78716c" },
  { key: "DATE", label: "Today's Date", color: "#64748b" },
];

const SIG_TYPES = [
  { key: "tenant", label: "Member Signature", color: "#3b82f6" },
  { key: "admin", label: "Licensor Signature", color: "#006b5f" },
];

function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

function pdfToCss(pos, scale, pageH) {
  return { x: pos.x * scale, y: (pageH - pos.y - pos.height) * scale, width: pos.width * scale, height: pos.height * scale };
}
function cssToPdf(css, scale, pageH) {
  return { x: Math.round(css.x / scale), y: Math.round(pageH - css.y / scale - css.height / scale), width: Math.round(css.width / scale), height: Math.round(css.height / scale) };
}

function DraggableField({ label, color, cssBounds, containerWidth, containerHeight, onUpdate, onRemove, fontSize }) {
  const [pos, setPos] = useState(cssBounds);
  const dragState = useRef(null);

  useEffect(() => { setPos(cssBounds); }, [cssBounds.x, cssBounds.y, cssBounds.width, cssBounds.height]);

  const startDrag = useCallback((e) => {
    e.preventDefault();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    dragState.current = { startX: cx, startY: cy, orig: { ...pos } };
    const onMove = (ev) => {
      const mx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const my = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const d = dragState.current;
      if (!d) return;
      setPos(p => ({
        ...p,
        x: clamp(d.orig.x + mx - d.startX, 0, containerWidth - p.width),
        y: clamp(d.orig.y + my - d.startY, 0, containerHeight - p.height),
      }));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onUp);
      setPos(p => { onUpdate(p); return p; });
      dragState.current = null;
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onUp);
  }, [pos, containerWidth, containerHeight, onUpdate]);

  return (
    <div
      className="absolute select-none"
      style={{ left: pos.x, top: pos.y, width: pos.width, height: pos.height }}
    >
      <div
        className="w-full h-full border-2 rounded-sm cursor-grab active:cursor-grabbing flex items-center px-1 overflow-hidden"
        style={{ borderColor: color, backgroundColor: `${color}15` }}
        onMouseDown={startDrag}
        onTouchStart={startDrag}
      >
        <span className="text-[9px] font-bold truncate" style={{ color, fontSize: fontSize ? `${fontSize}px` : undefined }}>{label}</span>
      </div>
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center hover:bg-red-600"
        >
          ×
        </button>
      )}
    </div>
  );
}

export default function PdfFieldPlacer({ pdfUrl, fields = [], signatures = {}, onFieldsChange, onSignaturesChange }) {
  const [numPages, setNumPages] = useState(null);
  const [viewPage, setViewPage] = useState(1);
  const [pageDims, setPageDims] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const scale = pageDims ? RENDER_WIDTH / pageDims.width : 1;
  const containerHeight = pageDims ? pageDims.height * scale : 792;

  // Available fields not yet placed
  const placedKeys = new Set(fields.map(f => f.key));
  const availableFields = FIELD_TYPES.filter(f => !placedKeys.has(f.key));

  function addField(fieldType) {
    const newField = {
      key: fieldType.key,
      label: fieldType.label,
      color: fieldType.color,
      page: viewPage,
      x: 100, y: 400, width: 180, height: 18,
      fontSize: 11,
    };
    onFieldsChange([...fields, newField]);
  }

  function updateField(index, cssPos) {
    if (!pageDims) return;
    const pdf = cssToPdf(cssPos, scale, pageDims.height);
    const updated = [...fields];
    updated[index] = { ...updated[index], x: pdf.x, y: pdf.y, width: pdf.width, height: pdf.height };
    onFieldsChange(updated);
  }

  function removeField(index) {
    onFieldsChange(fields.filter((_, i) => i !== index));
  }

  function updateSignature(role, cssPos) {
    if (!pageDims) return;
    const pdf = cssToPdf(cssPos, scale, pageDims.height);
    onSignaturesChange({ ...signatures, [role]: { ...signatures[role], x: pdf.x, y: pdf.y, width: pdf.width, height: pdf.height } });
  }

  function handleSigPageChange(role, page) {
    onSignaturesChange({ ...signatures, [role]: { ...signatures[role], page } });
  }

  // Visible items on current page
  const visibleFields = fields.filter(f => f.page === viewPage).map((f, i) => ({ ...f, originalIndex: fields.indexOf(f) }));
  const resolveP = (p) => (p === "last" && numPages) ? numPages : (typeof p === "number" ? p : 1);
  const visibleSigs = SIG_TYPES.filter(s => resolveP(signatures[s.key]?.page ?? "last") === viewPage);

  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;

  return (
    <div className="space-y-3">
      {/* Toolbar: add fields */}
      <div className="space-y-2">
        <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">
          Add Data Fields <span className="normal-case tracking-normal text-[#bbcac6]">— click to place on page {viewPage}</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {availableFields.map(f => (
            <button key={f.key} onClick={() => addField(f)} type="button"
              className="px-2 py-1 rounded-md text-[10px] font-bold border transition-colors hover:opacity-80"
              style={{ borderColor: f.color, color: f.color, backgroundColor: `${f.color}10` }}>
              + {f.label}
            </button>
          ))}
          {availableFields.length === 0 && <span className="text-[10px] text-[#bbcac6]">All fields placed</span>}
        </div>
      </div>

      {/* Page nav */}
      {numPages && numPages > 1 && (
        <div className="flex items-center gap-2">
          <button type="button" disabled={viewPage <= 1} onClick={() => setViewPage(p => Math.max(1, p - 1))}
            className="px-2 py-1 text-xs border border-border rounded disabled:opacity-40">Prev</button>
          <span className="text-xs text-muted-foreground">Page {viewPage} of {numPages}</span>
          <button type="button" disabled={viewPage >= numPages} onClick={() => setViewPage(p => Math.min(numPages, p + 1))}
            className="px-2 py-1 text-xs border border-border rounded disabled:opacity-40">Next</button>
        </div>
      )}

      {/* PDF + overlays */}
      <div className="relative border border-border rounded-lg overflow-hidden bg-gray-100 inline-block" style={{ width: RENDER_WIDTH }}>
        {loading && <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground z-10">Loading PDF...</div>}

        <Document
          file={pdfUrl}
          onLoadSuccess={({ numPages: n }) => { setNumPages(n); setViewPage(n); setLoading(false); }}
          onLoadError={(err) => { setError("Failed to load PDF."); setLoading(false); }}
          loading={null}
        >
          <Page pageNumber={viewPage} width={RENDER_WIDTH}
            onLoadSuccess={(page) => { const [,,w,h] = page.view; setPageDims({ width: w, height: h }); }}
            renderAnnotationLayer={false} renderTextLayer={false} />
        </Document>

        {/* Text field overlays */}
        {pageDims && visibleFields.map((f) => {
          const css = pdfToCss(f, scale, pageDims.height);
          return (
            <DraggableField key={f.key} label={f.label} color={f.color} fontSize={f.fontSize}
              cssBounds={css} containerWidth={RENDER_WIDTH} containerHeight={containerHeight}
              onUpdate={(newCss) => updateField(f.originalIndex, newCss)}
              onRemove={() => removeField(f.originalIndex)} />
          );
        })}

        {/* Signature overlays */}
        {pageDims && visibleSigs.map((s) => {
          const pos = signatures[s.key] || { page: 1, x: 50, y: 120, width: 200, height: 60 };
          const css = pdfToCss(pos, scale, pageDims.height);
          return (
            <DraggableField key={`sig-${s.key}`} label={`✍ ${s.label}`} color={s.color}
              cssBounds={css} containerWidth={RENDER_WIDTH} containerHeight={containerHeight}
              onUpdate={(newCss) => updateSignature(s.key, newCss)} />
          );
        })}
      </div>

      {/* Placed fields summary */}
      {fields.length > 0 && (
        <div className="text-[10px] text-muted-foreground font-mono space-y-0.5">
          {fields.map((f, i) => (
            <div key={f.key}>
              {f.label}: pg{f.page} x={f.x} y={f.y} w={f.width}
              <button onClick={() => removeField(i)} className="ml-2 text-red-400 hover:text-red-600">remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
