import { useRef, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { toast } from "sonner";

const RESIDENCY_OPTIONS = [
  { value: "SINGAPOREAN", label: "Singaporean / PR" },
  { value: "FOREIGNER", label: "Foreigner" },
];

const SG_ID_TYPES = [
  { value: "NRIC", label: "NRIC" },
];

const FOREIGNER_ID_TYPES = [
  { value: "PASSPORT", label: "Passport" },
  { value: "WORK_PERMIT", label: "Work Permit" },
  { value: "EMPLOYMENT_PASS", label: "Employment Pass" },
];

function compressImage(file, maxPx = 1500, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width > height) {
          height = Math.round((height * maxPx) / width);
          width = maxPx;
        } else {
          width = Math.round((width * maxPx) / height);
          height = maxPx;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Compression failed"));
          resolve(blob);
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function IdScanForm({ onboarding, advanceStep }) {
  const { profile } = useAuth();
  const frontInputRef = useRef(null);
  const backInputRef = useRef(null);

  // Auto-detect residency from nationality set in previous step
  const nationality = profile?.tenant_details?.nationality || "";
  const isSgNationality = ["Singaporean", "Singapore PR"].includes(nationality);
  const [residency, setResidency] = useState(
    nationality ? (isSgNationality ? "SINGAPOREAN" : "FOREIGNER") : null
  );
  const [idType, setIdType] = useState(isSgNationality ? "NRIC" : "PASSPORT");
  const [form, setForm] = useState({ id_number: "", id_expiry: "" });
  const isForeigner = residency === "FOREIGNER";
  const needsExpiry = isForeigner; // Foreigners must provide expiry date
  const [frontFile, setFrontFile] = useState(null);
  const [backFile, setBackFile] = useState(null);
  const [frontPreview, setFrontPreview] = useState(null);
  const [backPreview, setBackPreview] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleFrontPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFrontFile(file);
    setFrontPreview(URL.createObjectURL(file));
    await runOcr(file);
  }

  async function handleBackPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackFile(file);
    setBackPreview(URL.createObjectURL(file));
  }

  async function runOcr(file) {
    setScanning(true);
    try {
      const compressed = await compressImage(file);
      const base64 = await blobToBase64(compressed);

      const res = await fetch("/api/portal/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: base64, id_type: idType }),
      });

      if (!res.ok) throw new Error("OCR request failed");
      const { id_number, id_expiry } = await res.json();

      setForm((prev) => ({
        id_number: id_number ?? prev.id_number,
        id_expiry: id_expiry ?? prev.id_expiry,
      }));
      toast.success("Document scanned — please verify the details.");
    } catch (err) {
      console.error("OCR failed:", err);
      toast.error("Scan failed — please fill in the details manually.");
    } finally {
      setScanning(false);
    }
  }

  async function uploadPhoto(file, side) {
    const compressed = await compressImage(file);
    const timestamp = Date.now();
    const path = `tenants/${profile.id}/id-${side}-${timestamp}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("tenant-documents")
      .upload(path, compressed, { contentType: "image/jpeg", upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from("tenant-documents")
      .getPublicUrl(path);

    return data.publicUrl;
  }

  // Check if document is expiring within 3 months
  const expiryWarning = (() => {
    if (!needsExpiry || !form.id_expiry) return null;
    const expDate = new Date(form.id_expiry);
    const now = new Date();
    const threeMonths = new Date();
    threeMonths.setMonth(threeMonths.getMonth() + 3);
    if (expDate < now) return "expired";
    if (expDate < threeMonths) return "expiring_soon";
    return null;
  })();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!residency) {
      setError("Please select your residency status.");
      return;
    }
    if (!form.id_number.trim()) {
      setError("ID number is required.");
      return;
    }
    if (!frontFile) {
      setError("Please upload a photo of the front of your ID.");
      return;
    }
    if (needsExpiry && !form.id_expiry) {
      setError("Expiry date is required for foreign passes.");
      return;
    }
    if (expiryWarning === "expired") {
      setError("Your document has expired. Please provide a valid document.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const frontUrl = await uploadPhoto(frontFile, "front");
      const backUrl = backFile ? await uploadPhoto(backFile, "back") : null;

      const { error: upsertError } = await supabase
        .from("tenant_details")
        .upsert(
          {
            tenant_profile_id: profile.id,
            id_type: idType,
            id_number: form.id_number.trim(),
            id_expiry: form.id_expiry || null,
            id_front_url: frontUrl,
            id_back_url: backUrl ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_profile_id" }
        );

      if (upsertError) throw upsertError;

      await advanceStep("id_verification_completed_at");

      // If foreigner pass is expiring soon, create an admin task
      if (expiryWarning === "expiring_soon" && form.id_expiry) {
        try {
          const tenantName = profile?.tenant_details?.full_name || profile?.full_name || form.id_number;
          await supabase.from("admin_tasks").insert({
            title: `Pass expiring: ${tenantName} (${idType.replace(/_/g, " ")})`,
            description: `${tenantName}'s ${idType.replace(/_/g, " ")} (${form.id_number}) expires on ${new Date(form.id_expiry).toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" })}. Follow up to ensure renewal.`,
            category: "ONBOARDING",
            priority: "HIGH",
            status: "PENDING",
            tenant_name: tenantName,
            due_date: form.id_expiry,
          });
        } catch (taskErr) {
          console.error("Failed to create expiry task:", taskErr);
        }
      }
    } catch (err) {
      console.error("ID verification failed:", err);
      setError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Residency selector */}
      <div>
        <Label className="block mb-2">Are you a Singaporean/PR or Foreigner?</Label>
        <div className="grid grid-cols-2 gap-2">
          {RESIDENCY_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setResidency(value);
                setIdType(value === "SINGAPOREAN" ? "NRIC" : "PASSPORT");
                setForm((prev) => ({ ...prev, id_expiry: "" }));
              }}
              className={`py-3 px-4 rounded-xl text-sm font-semibold border-2 transition-all ${
                residency === value
                  ? "bg-[#006b5f] text-white border-[#006b5f]"
                  : "bg-background text-foreground border-border hover:border-[#006b5f]/40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ID type selector — only show if residency selected */}
      {residency && (
        <div>
          <Label className="block mb-2">Document Type</Label>
          <div className="grid grid-cols-2 gap-2">
            {(residency === "SINGAPOREAN" ? SG_ID_TYPES : FOREIGNER_ID_TYPES).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setIdType(value)}
                className={`py-2 px-3 rounded-md text-sm font-medium border transition-colors ${
                  idType === value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:bg-accent"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Front photo */}
      <div>
        <Label className="block mb-2">
          Front of ID{" "}
          <span className="text-muted-foreground font-normal">(required)</span>
        </Label>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => frontInputRef.current?.click()}
            disabled={scanning}
          >
            {scanning ? "Scanning…" : frontFile ? "Rescan" : "Scan Document"}
          </Button>
          <input
            ref={frontInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFrontPhoto}
          />
          {frontPreview && (
            <img
              src={frontPreview}
              alt="ID front"
              className="h-16 w-24 object-cover rounded border"
            />
          )}
        </div>
      </div>

      {/* Back photo (NRIC only) */}
      {idType === "NRIC" && (
        <div>
          <Label className="block mb-2">
            Back of NRIC{" "}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => backInputRef.current?.click()}
            >
              {backFile ? "Change" : "Upload Back"}
            </Button>
            <input
              ref={backInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleBackPhoto}
            />
            {backPreview && (
              <img
                src={backPreview}
                alt="ID back"
                className="h-16 w-24 object-cover rounded border"
              />
            )}
          </div>
        </div>
      )}

      {/* ID fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="id_number">
            {residency === "SINGAPOREAN" ? "NRIC Number" : "Document Number"}
          </Label>
          <Input
            id="id_number"
            name="id_number"
            value={form.id_number}
            onChange={handleChange}
            placeholder={residency === "SINGAPOREAN" ? "e.g. S1234567A" : "e.g. E1234567A"}
            required
          />
        </div>
        {needsExpiry ? (
          <div className="space-y-1.5">
            <Label htmlFor="id_expiry">
              Expiry Date <span className="text-red-500">*</span>
            </Label>
            <Input
              id="id_expiry"
              name="id_expiry"
              type="date"
              value={form.id_expiry}
              onChange={handleChange}
              required
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="id_expiry">Expiry Date <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="id_expiry"
              name="id_expiry"
              type="date"
              value={form.id_expiry}
              onChange={handleChange}
            />
          </div>
        )}
      </div>

      {/* Expiry warning banner */}
      {expiryWarning === "expired" && (
        <div className="rounded-xl border-2 border-red-500 bg-red-50 p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-red-600 text-[24px] shrink-0 mt-0.5">error</span>
          <div>
            <p className="text-sm font-bold text-red-800">Document Expired</p>
            <p className="text-xs text-red-700 mt-1">
              Your {idType.replace(/_/g, " ")} has expired. You cannot proceed with an expired document.
              Please provide a valid document or contact your employer for renewal.
            </p>
          </div>
        </div>
      )}
      {expiryWarning === "expiring_soon" && (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-amber-600 text-[24px] shrink-0 mt-0.5">warning</span>
          <div>
            <p className="text-sm font-bold text-amber-800">Document Expiring Soon</p>
            <p className="text-xs text-amber-700 mt-1">
              Your {idType.replace(/_/g, " ")} expires on{" "}
              {new Date(form.id_expiry).toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" })}.
              Please ensure you renew it before expiry. The management team will be notified.
            </p>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button
        type="submit"
        disabled={submitting || scanning}
        className="w-full sm:w-auto"
      >
        {submitting ? "Uploading…" : "Confirm & Continue"}
      </Button>
    </form>
  );
}
