import { useState, useRef, useCallback, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const RENDER_WIDTH = 612; // CSS pixels for the rendered PDF page

const DEFAULT_POSITIONS = {
  tenant: { page: 1, x: 72, y: 100, width: 200, height: 60 },
  admin: { page: 1, x: 350, y: 100, width: 200, height: 60 },
};

const BOX_CONFIG = {
  tenant: {
    label: "Tenant Signature",
    borderClass: "border-blue-500",
    bgClass: "bg-blue-50",
    headerClass: "bg-blue-500 text-white",
    handleClass: "bg-blue-500",
  },
  admin: {
    label: "Admin Signature",
    borderClass: "border-emerald-500",
    bgClass: "bg-emerald-50",
    headerClass: "bg-emerald-500 text-white",
    handleClass: "bg-emerald-500",
  },
};

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Convert PDF-point positions to CSS pixel positions for rendering.
 * PDF y=0 is at the bottom; CSS y=0 is at the top.
 */
function pdfToCss(pos, scale, pageHeightPts) {
  return {
    x: pos.x * scale,
    y: (pageHeightPts - pos.y - pos.height) * scale,
    width: pos.width * scale,
    height: pos.height * scale,
  };
}

/**
 * Convert CSS pixel positions back to PDF points.
 */
function cssToPdf(css, scale, pageHeightPts) {
  return {
    x: Math.round(css.x / scale),
    y: Math.round((pageHeightPts - css.y / scale - css.height / scale)),
    width: Math.round(css.width / scale),
    height: Math.round(css.height / scale),
  };
}

function DraggableBox({
  role,
  cssBounds,
  pageCount,
  currentPage,
  onPageChange,
  containerWidth,
  containerHeight,
  onUpdate,
}) {
  const config = BOX_CONFIG[role];
  const boxRef = useRef(null);
  const dragState = useRef(null);

  const [pos, setPos] = useState(cssBounds);

  // Sync when parent changes (e.g. page switch)
  useEffect(() => {
    setPos(cssBounds);
  }, [cssBounds.x, cssBounds.y, cssBounds.width, cssBounds.height]);

  const commitPosition = useCallback(
    (newPos) => {
      onUpdate(newPos);
    },
    [onUpdate]
  );

  // --- Drag (move) ---
  const handleDragStart = useCallback(
    (e) => {
      e.preventDefault();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      dragState.current = { type: "move", startX: clientX, startY: clientY, origPos: { ...pos } };

      const onMove = (ev) => {
        const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
        const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
        const ds = dragState.current;
        if (!ds || ds.type !== "move") return;
        const dx = cx - ds.startX;
        const dy = cy - ds.startY;
        const newX = clamp(ds.origPos.x + dx, 0, containerWidth - pos.width);
        const newY = clamp(ds.origPos.y + dy, 0, containerHeight - pos.height);
        setPos((p) => ({ ...p, x: newX, y: newY }));
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.removeEventListener("touchmove", onMove);
        document.removeEventListener("touchend", onUp);
        setPos((p) => {
          commitPosition(p);
          return p;
        });
        dragState.current = null;
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.addEventListener("touchmove", onMove, { passive: false });
      document.addEventListener("touchend", onUp);
    },
    [pos, containerWidth, containerHeight, commitPosition]
  );

  // --- Resize ---
  const handleResizeStart = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      dragState.current = { type: "resize", startX: clientX, startY: clientY, origPos: { ...pos } };

      const onMove = (ev) => {
        const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
        const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
        const ds = dragState.current;
        if (!ds || ds.type !== "resize") return;
        const dx = cx - ds.startX;
        const dy = cy - ds.startY;
        const newW = clamp(ds.origPos.width + dx, 60, containerWidth - ds.origPos.x);
        const newH = clamp(ds.origPos.height + dy, 30, containerHeight - ds.origPos.y);
        setPos((p) => ({ ...p, width: newW, height: newH }));
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.removeEventListener("touchmove", onMove);
        document.removeEventListener("touchend", onUp);
        setPos((p) => {
          commitPosition(p);
          return p;
        });
        dragState.current = null;
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.addEventListener("touchmove", onMove, { passive: false });
      document.addEventListener("touchend", onUp);
    },
    [pos, containerWidth, containerHeight, commitPosition]
  );

  const pageOptions = [];
  for (let i = 1; i <= pageCount; i++) {
    pageOptions.push(
      <option key={i} value={i}>
        Page {i}
      </option>
    );
  }

  return (
    <div
      ref={boxRef}
      className={`absolute border-2 ${config.borderClass} ${config.bgClass} bg-opacity-40 select-none`}
      style={{
        left: pos.x,
        top: pos.y,
        width: pos.width,
        height: pos.height,
      }}
    >
      {/* Header / drag handle */}
      <div
        className={`${config.headerClass} text-[10px] font-semibold px-1.5 py-0.5 cursor-grab active:cursor-grabbing flex items-center justify-between`}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <span>{config.label}</span>
        <select
          className="bg-white/20 text-white text-[9px] rounded px-0.5 cursor-pointer"
          value={currentPage}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => onPageChange(Number(e.target.value))}
        >
          {pageOptions}
        </select>
      </div>

      {/* Resize handle (bottom-right) */}
      <div
        className={`absolute bottom-0 right-0 w-3 h-3 ${config.handleClass} cursor-nwse-resize`}
        onMouseDown={handleResizeStart}
        onTouchStart={handleResizeStart}
      />

      {/* Debug coordinates */}
      <div className="absolute -bottom-4 left-0 text-[8px] text-gray-500 whitespace-nowrap">
        x:{Math.round(pos.x)} y:{Math.round(pos.y)} w:{Math.round(pos.width)} h:{Math.round(pos.height)}
      </div>
    </div>
  );
}

export default function DraggableSignaturePlacer({ pdfUrl, value, onChange }) {
  const [numPages, setNumPages] = useState(null);
  const [viewPage, setViewPage] = useState(1);
  const [pageDims, setPageDims] = useState(null); // { width, height } in PDF points
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Internal positions in PDF points
  const positions = {
    tenant: value?.tenant ?? DEFAULT_POSITIONS.tenant,
    admin: value?.admin ?? DEFAULT_POSITIONS.admin,
  };

  const onDocumentLoadSuccess = useCallback(({ numPages: n }) => {
    setNumPages(n);
    setLoading(false);
  }, []);

  const onPageLoadSuccess = useCallback((page) => {
    const [, , w, h] = page.view; // [x, y, width, height] in points
    setPageDims({ width: w, height: h });
  }, []);

  const onDocumentLoadError = useCallback((err) => {
    console.error("PDF load error:", err);
    setError("Failed to load PDF. Please check the URL.");
    setLoading(false);
  }, []);

  const scale = pageDims ? RENDER_WIDTH / pageDims.width : 1;
  const containerHeight = pageDims ? pageDims.height * scale : 792;

  const handleBoxUpdate = useCallback(
    (role, cssPos) => {
      if (!pageDims) return;
      const pdfPos = cssToPdf(cssPos, scale, pageDims.height);
      const newPositions = {
        ...positions,
        [role]: {
          ...positions[role],
          x: pdfPos.x,
          y: pdfPos.y,
          width: pdfPos.width,
          height: pdfPos.height,
        },
      };
      onChange(newPositions);
    },
    [pageDims, scale, positions, onChange]
  );

  const handlePageChange = useCallback(
    (role, page) => {
      const newPositions = {
        ...positions,
        [role]: { ...positions[role], page },
      };
      onChange(newPositions);
    },
    [positions, onChange]
  );

  // Navigate to a page that has a signature box
  const visibleBoxes = ["tenant", "admin"].filter(
    (role) => positions[role].page === viewPage
  );

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Page navigation */}
      {numPages && numPages > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-2 py-1 text-xs border border-border rounded disabled:opacity-40"
            disabled={viewPage <= 1}
            onClick={() => setViewPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <span className="text-xs text-muted-foreground">
            Page {viewPage} of {numPages}
          </span>
          <button
            type="button"
            className="px-2 py-1 text-xs border border-border rounded disabled:opacity-40"
            disabled={viewPage >= numPages}
            onClick={() => setViewPage((p) => Math.min(numPages, p + 1))}
          >
            Next
          </button>

          {/* Quick jump to pages with boxes */}
          <span className="ml-2 text-[10px] text-muted-foreground">
            Tenant: pg {positions.tenant.page} | Admin: pg {positions.admin.page}
          </span>
        </div>
      )}

      {/* PDF + overlays */}
      <div
        className="relative border border-border rounded-lg overflow-hidden bg-gray-100 inline-block"
        style={{ width: RENDER_WIDTH }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground z-10">
            Loading PDF...
          </div>
        )}

        <Document
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={null}
        >
          <Page
            pageNumber={viewPage}
            width={RENDER_WIDTH}
            onLoadSuccess={onPageLoadSuccess}
            renderAnnotationLayer={false}
            renderTextLayer={false}
          />
        </Document>

        {/* Signature boxes overlay */}
        {pageDims &&
          visibleBoxes.map((role) => {
            const pos = positions[role];
            const css = pdfToCss(pos, scale, pageDims.height);
            return (
              <DraggableBox
                key={role}
                role={role}
                cssBounds={css}
                pageCount={numPages || 1}
                currentPage={pos.page}
                onPageChange={(pg) => handlePageChange(role, pg)}
                containerWidth={RENDER_WIDTH}
                containerHeight={containerHeight}
                onUpdate={(newCss) => handleBoxUpdate(role, newCss)}
              />
            );
          })}
      </div>

      {/* Current values debug */}
      <div className="text-[10px] text-muted-foreground font-mono space-y-0.5">
        <div>
          Tenant (PDF pts): page={positions.tenant.page} x={positions.tenant.x} y={positions.tenant.y} w={positions.tenant.width} h={positions.tenant.height}
        </div>
        <div>
          Admin (PDF pts): page={positions.admin.page} x={positions.admin.x} y={positions.admin.y} w={positions.admin.width} h={positions.admin.height}
        </div>
      </div>
    </div>
  );
}
