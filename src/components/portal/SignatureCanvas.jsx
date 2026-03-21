import { useRef, useState, useEffect, useCallback } from "react";
import SignaturePad from "react-signature-canvas";
import { Button } from "../ui/button";

export default function SignatureCanvas({ signatureRef: externalRef }) {
  const padRef = useRef(null);
  const typeCanvasRef = useRef(null);
  const [mode, setMode] = useState("draw");
  const [typedName, setTypedName] = useState("");

  // Expose getSignatureData via externalRef
  useEffect(() => {
    if (!externalRef) return;
    externalRef.current = {
      getSignatureData,
      isEmpty: () => {
        if (mode === "draw") {
          return !padRef.current || padRef.current.isEmpty();
        }
        return !typedName.trim();
      },
    };
  });

  function getSignatureData() {
    if (mode === "draw") {
      if (!padRef.current || padRef.current.isEmpty()) return null;
      return padRef.current.getTrimmedCanvas().toDataURL("image/png");
    }

    // Type mode: render text onto a canvas
    const canvas = typeCanvasRef.current;
    if (!canvas || !typedName.trim()) return null;
    return canvas.toDataURL("image/png");
  }

  // Render typed name onto canvas whenever it changes
  const renderTypedSignature = useCallback(() => {
    const canvas = typeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!typedName.trim()) return;
    ctx.font = "italic 40px Georgia, serif";
    ctx.fillStyle = "#1a1a1a";
    ctx.textBaseline = "middle";
    ctx.fillText(typedName, 20, canvas.height / 2);
  }, [typedName]);

  useEffect(() => {
    renderTypedSignature();
  }, [renderTypedSignature]);

  function handleClear() {
    if (mode === "draw" && padRef.current) {
      padRef.current.clear();
    } else {
      setTypedName("");
    }
  }

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("draw")}
          className={`px-3 py-1.5 text-sm rounded-md border font-medium transition-colors ${
            mode === "draw"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background border-border text-muted-foreground hover:bg-accent"
          }`}
        >
          Draw
        </button>
        <button
          type="button"
          onClick={() => setMode("type")}
          className={`px-3 py-1.5 text-sm rounded-md border font-medium transition-colors ${
            mode === "type"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background border-border text-muted-foreground hover:bg-accent"
          }`}
        >
          Type
        </button>
      </div>

      {/* Draw mode */}
      {mode === "draw" && (
        <div className="border border-border rounded-md overflow-hidden bg-white">
          <SignaturePad
            ref={padRef}
            penColor="black"
            canvasProps={{
              className: "w-full",
              style: { height: 140, touchAction: "none" },
            }}
          />
        </div>
      )}

      {/* Type mode */}
      {mode === "type" && (
        <div className="space-y-2">
          <input
            type="text"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder="Type your full name"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="border border-border rounded-md overflow-hidden bg-white">
            <canvas
              ref={typeCanvasRef}
              width={500}
              height={100}
              className="w-full"
              style={{ height: 100 }}
            />
          </div>
          {typedName && (
            <p className="text-xs text-muted-foreground">
              Preview — italic signature generated from typed name
            </p>
          )}
        </div>
      )}

      <Button type="button" variant="outline" size="sm" onClick={handleClear}>
        Clear
      </Button>
    </div>
  );
}
