import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "../ui/button";
import SignatureCanvas from "./SignatureCanvas";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Helper: resolve a storage path or full URL to a signed URL
async function resolveSignedUrl(pathOrUrl) {
  if (!pathOrUrl) return null;

  // Extract storage path from full URL if needed
  let storagePath = pathOrUrl;
  if (pathOrUrl.includes("/tenant-documents/")) {
    storagePath = pathOrUrl.split("/tenant-documents/")[1].split("?")[0];
  } else if (pathOrUrl.startsWith("http")) {
    // Unknown URL format — try it directly but verify it works
    try {
      const check = await fetch(pathOrUrl, { method: "HEAD" });
      if (check.ok) return pathOrUrl;
    } catch {}
    return null;
  }

  const { data, error } = await supabase.storage
    .from("tenant-documents")
    .createSignedUrl(storagePath, 3600);
  if (error) {
    // File might not exist
    return null;
  }
  return data.signedUrl;
}

function formatDateTime(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Singapore",
  });
}

// ─── UNSIGNED STATE ────────────────────────────────────────────────────────────

function UnsignedView({ onboarding, pdfUrl, advanceStep, refetch, navigate }) {
  const signatureRef = useRef(null);
  const [numPages, setNumPages] = useState(null);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState(null);

  async function handleSign() {
    const sigData = signatureRef.current?.getSignatureData();
    if (!sigData) {
      setError("Please sign before submitting.");
      return;
    }

    setError(null);
    setSigning(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const res = await fetch("/api/portal/sign-ta", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
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
      if (refetch) await refetch();
      else await advanceStep("ta_signed_at");
      if (navigate) navigate("/portal/onboarding/signed", { state: { signedAt: new Date().toISOString(), onboardingId: onboarding.id } });
    } catch (err) {
      console.error("Sign error:", err);
      setError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setSigning(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* PDF viewer */}
      <div className="border border-border rounded-md overflow-auto bg-gray-50 max-h-[500px]">
        <Document
          file={pdfUrl}
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

      {advanceStep && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => advanceStep("ta_skipped")}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            Skip for now
          </button>
          <p className="text-xs text-muted-foreground mt-1">
            You can sign the agreement later from your Documents page
          </p>
        </div>
      )}
    </div>
  );
}

// ─── TENANT_SIGNED STATE ───────────────────────────────────────────────────────

function TenantSignedView({ onboarding }) {
  const [signedUrl, setSignedUrl] = useState(null);

  useEffect(() => {
    if (!onboarding?.ta_signed_url) return;
    resolveSignedUrl(onboarding.ta_signed_url).then(setSignedUrl);
  }, [onboarding?.ta_signed_url]);

  return (
    <div className="space-y-6">
      {/* Success banner */}
      <div className="rounded-lg border border-green-200 bg-green-50 p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-green-800">You've signed the agreement</p>
            <p className="text-xs text-green-700 mt-0.5">
              Signed on {formatDateTime(onboarding.ta_signed_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Waiting for counter-signature */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          {/* Pulsing indicator */}
          <span className="relative flex h-3 w-3 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">
              Waiting for admin counter-signature
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              The Hyve team will countersign your agreement shortly. You'll receive an email once it's fully executed.
            </p>
          </div>
        </div>
      </div>

      {/* View signed PDF */}
      {signedUrl && (
        <div>
          <a
            href={signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Preview your signed agreement
          </a>
        </div>
      )}
    </div>
  );
}

// ─── FULLY_EXECUTED STATE ──────────────────────────────────────────────────────

function FullyExecutedView({ onboarding }) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const url = await resolveSignedUrl(onboarding.admin_signed_url);
      if (!url) {
        toast.error("Could not generate download link. Please try again.");
        return;
      }
      // Force download instead of opening in browser
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `Licence-Agreement-${onboarding.ref_number || "signed"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error("Download failed. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Fully executed banner */}
      <div className="rounded-lg border border-[#006b5f]/30 bg-[#006b5f]/5 p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-[#006b5f]/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-[#006b5f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-[#006b5f]">Agreement fully executed</p>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#006b5f] text-white uppercase tracking-wide">
                Completed
              </span>
            </div>
            <p className="text-xs text-[#006b5f]/80 mt-0.5">
              Both parties have signed. Your tenancy agreement is legally binding.
            </p>
          </div>
        </div>
      </div>

      {/* Signing audit trail */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Signing Record
        </p>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <span className="text-foreground font-medium">Tenant signed</span>
            </div>
            <span className="text-muted-foreground text-xs">{formatDateTime(onboarding.ta_signed_at)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <span className="text-foreground font-medium">Licensor counter-signed</span>
            </div>
            <span className="text-muted-foreground text-xs">{formatDateTime(onboarding.admin_signed_at)}</span>
          </div>
        </div>
      </div>

      {/* Download button */}
      {onboarding.admin_signed_url && (
        <Button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="w-full sm:w-auto"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {downloading ? "Preparing…" : "Download Agreement"}
        </Button>
      )}
    </div>
  );
}

// ─── MAIN EXPORT ───────────────────────────────────────────────────────────────

export default function AgreementViewer({ onboarding, advanceStep, refetch }) {
  const navigate = useNavigate();
  const [pdfUrl, setPdfUrl] = useState(null);

  const taPath = onboarding?.ta_document_url;
  const signingStatus = onboarding?.signing_status ?? "UNSIGNED";

  // Only need the base PDF URL for the UNSIGNED state
  useEffect(() => {
    if (!taPath || signingStatus !== "UNSIGNED") return;
    resolveSignedUrl(taPath).then(setPdfUrl);
  }, [taPath, signingStatus]);

  if (!taPath) {
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
          Your licence agreement is being prepared. Admin will upload it shortly.
          Check back here once you receive a notification.
        </p>
        {advanceStep && (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => advanceStep("ta_skipped")}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              Skip for now
            </button>
            <p className="text-xs text-muted-foreground mt-1">
              You can sign the agreement later from your Documents page
            </p>
          </div>
        )}
      </div>
    );
  }

  if (signingStatus === "FULLY_EXECUTED") {
    return <FullyExecutedView onboarding={onboarding} />;
  }

  if (signingStatus === "TENANT_SIGNED") {
    return <TenantSignedView onboarding={onboarding} />;
  }

  // UNSIGNED — if PDF URL failed to resolve, show "being prepared"
  if (taPath && !pdfUrl) {
    return (
      <div className="rounded-md border border-dashed border-border p-8 text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-amber-50 flex items-center justify-center">
          <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-foreground mb-1">Agreement being prepared</p>
        <p className="text-sm text-muted-foreground">The document is being processed. Please check back shortly.</p>
        {advanceStep && (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => advanceStep("ta_skipped")}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              Skip for now
            </button>
            <p className="text-xs text-muted-foreground mt-1">
              You can sign the agreement later from your Documents page
            </p>
          </div>
        )}
      </div>
    );
  }

  // UNSIGNED — show PDF + signature pad
  return (
    <UnsignedView
      onboarding={onboarding}
      pdfUrl={pdfUrl}
      advanceStep={advanceStep}
      refetch={refetch}
      navigate={navigate}
    />
  );
}
