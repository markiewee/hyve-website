import { useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "../ui/button";
import SignatureCanvas from "./SignatureCanvas";
import { toast } from "sonner";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function AgreementViewer({ onboarding, advanceStep, refetch }) {
  const signatureRef = useRef(null);
  const [numPages, setNumPages] = useState(null);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState(null);

  const taUrl = onboarding?.ta_document_url;

  async function handleSign() {
    const sigData = signatureRef.current?.getSignatureData();
    if (!sigData) {
      setError("Please sign before submitting.");
      return;
    }

    setError(null);
    setSigning(true);

    try {
      const res = await fetch("/api/portal/sign-ta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature_image_base64: sigData.split(",")[1] ?? sigData,
          onboarding_id: onboarding.id,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to sign agreement");
      }

      toast.success("Agreement signed!");
      // API advances step server-side — refetch to sync local state
      if (refetch) await refetch();
      // Also call advanceStep locally in case API doesn't update step
      else await advanceStep("ta_signed_at");
    } catch (err) {
      console.error("Sign error:", err);
      setError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setSigning(false);
    }
  }

  if (!taUrl) {
    return (
      <div className="rounded-md border border-dashed border-border p-8 text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-amber-50 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-amber-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <p className="text-sm font-medium text-foreground mb-1">
          Agreement being prepared
        </p>
        <p className="text-sm text-muted-foreground">
          Your licence agreement is being prepared. Admin will upload it
          shortly. Check back here once you receive a notification.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* PDF viewer */}
      <div className="border border-border rounded-md overflow-auto bg-gray-50 max-h-[500px]">
        <Document
          file={taUrl}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          loading={
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
              Loading agreement…
            </div>
          }
          error={
            <div className="flex items-center justify-center h-40 text-sm text-red-600">
              Failed to load agreement. Please try again.
            </div>
          }
        >
          {numPages &&
            Array.from({ length: numPages }, (_, i) => (
              <Page
                key={i + 1}
                pageNumber={i + 1}
                className="mb-2"
                width={Math.min(
                  typeof window !== "undefined" ? window.innerWidth - 80 : 600,
                  700
                )}
              />
            ))}
        </Document>
      </div>

      {/* Signature */}
      <div>
        <h3 className="text-sm font-medium text-foreground mb-3">
          Sign Agreement
        </h3>
        <SignatureCanvas signatureRef={signatureRef} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button
        type="button"
        onClick={handleSign}
        disabled={signing}
        className="w-full sm:w-auto"
      >
        {signing ? "Signing…" : "Sign Agreement"}
      </Button>
    </div>
  );
}
