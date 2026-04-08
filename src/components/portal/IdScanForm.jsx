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

const PASS_TYPES = [
  { value: "WORK_PERMIT", label: "Work Permit" },
  { value: "EMPLOYMENT_PASS", label: "Employment Pass" },
  { value: "S_PASS", label: "S Pass" },
  { value: "STUDENT_PASS", label: "Student Pass" },
  { value: "DEPENDANT_PASS", label: "Dependant Pass" },
  { value: "LONG_TERM_VISIT_PASS", label: "Long Term Visit Pass" },
  { value: "OTHER", label: "Other" },
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
  // Pre-fill from saved tenant_details if returning to this step
  const td = profile?.tenant_details || {};
  const savedIsForeigner = td.id_type === "PASSPORT";

  const [residency, setResidency] = useState(
    td.id_type ? (savedIsForeigner ? "FOREIGNER" : "SINGAPOREAN") :
    nationality ? (isSgNationality ? "SINGAPOREAN" : "FOREIGNER") : null
  );
  const [idType, setIdType] = useState(td.id_type || (isSgNationality ? "NRIC" : "PASSPORT"));
  const [form, setForm] = useState({ id_number: td.id_number || "", id_expiry: td.id_expiry || "" });
  const isForeigner = residency === "FOREIGNER";
  const needsExpiry = isForeigner;
  const [frontFile, setFrontFile] = useState(null);
  const [backFile, setBackFile] = useState(null);
  const [frontPreview, setFrontPreview] = useState(td.id_front_url || null);
  const [backPreview, setBackPreview] = useState(td.id_back_url || null);
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Foreigner pass (in addition to passport)
  const [passType, setPassType] = useState(td.pass_type || "WORK_PERMIT");
  const [passNumber, setPassNumber] = useState(td.pass_number || "");
  const [passExpiry, setPassExpiry] = useState(td.pass_expiry || "");
  const passInputRef = useRef(null);
  const [passFile, setPassFile] = useState(null);
  const [passPreview, setPassPreview] = useState(td.pass_url || null);

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

  // Check if pass is expiring within 3 months
  const passExpiryWarning = (() => {
    if (!isForeigner || !passExpiry) return null;
    const expDate = new Date(passExpiry);
    const now = new Date();
    const threeMonths = new Date();
    threeMonths.setMonth(threeMonths.getMonth() + 3);
    if (expDate < now) return "expired";
    if (expDate < threeMonths) return "expiring_soon";
    return null;
  })();

  // Check if passport is expiring within 3 months
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
    if (!frontFile && !frontPreview) {
      setError("Please upload a photo of the front of your ID.");
      return;
    }
    if (needsExpiry && !form.id_expiry) {
      setError("Passport expiry date is required.");
      return;
    }
    if (isForeigner && !passNumber.trim()) {
      setError("Pass number is required for foreigners.");
      return;
    }
    if (isForeigner && !passExpiry) {
      setError("Pass expiry date is required.");
      return;
    }
    if (isForeigner && !passFile && !passPreview) {
      setError("Please upload a photo of your pass (Work Permit / EP / S Pass).");
      return;
    }
    if (expiryWarning === "expired") {
      setError("Your passport has expired. Please provide a valid document.");
      return;
    }
    if (passExpiryWarning === "expired") {
      setError("Your pass has expired. Please provide a valid document.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const frontUrl = frontFile ? await uploadPhoto(frontFile, "front") : td.id_front_url;
      const backUrl = backFile ? await uploadPhoto(backFile, "back") : (td.id_back_url || null);
      const passUrl = passFile ? await uploadPhoto(passFile, "pass") : (td.pass_url || null);

      const { error: upsertError } = await supabase
        .from("tenant_details")
        .upsert(
          {
            tenant_profile_id: profile.id,
            id_type: isForeigner ? "PASSPORT" : idType,
            id_number: form.id_number.trim(),
            id_expiry: form.id_expiry || null,
            id_front_url: frontUrl,
            id_back_url: backUrl ?? null,
            pass_type: isForeigner ? passType : null,
            pass_number: isForeigner ? passNumber.trim() : null,
            pass_expiry: isForeigner ? passExpiry : null,
            pass_url: passUrl,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_profile_id" }
        );

      if (upsertError) throw upsertError;

      await advanceStep("id_verification_completed_at");

      // Create admin tasks for expiring documents
      const tenantName = profile?.tenant_details?.full_name || profile?.full_name || form.id_number;
      if (expiryWarning === "expiring_soon" && form.id_expiry) {
        try {
          await supabase.from("admin_tasks").insert({
            title: `Passport expiring: ${tenantName}`,
            description: `${tenantName}'s passport (${form.id_number}) expires on ${new Date(form.id_expiry).toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" })}. Follow up to ensure renewal.`,
            category: "ONBOARDING", priority: "HIGH", status: "PENDING",
            tenant_name: tenantName, due_date: form.id_expiry,
          });
        } catch (e) { console.error("Task creation failed:", e); }
      }
      if (passExpiryWarning === "expiring_soon" && passExpiry) {
        try {
          await supabase.from("admin_tasks").insert({
            title: `Pass expiring: ${tenantName} (${passType.replace(/_/g, " ")})`,
            description: `${tenantName}'s ${passType.replace(/_/g, " ")} (${passNumber}) expires on ${new Date(passExpiry).toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" })}. Follow up to ensure renewal.`,
            category: "ONBOARDING", priority: "URGENT", status: "PENDING",
            tenant_name: tenantName, due_date: passExpiry,
          });
        } catch (e) { console.error("Task creation failed:", e); }
      }

      // Legacy: old single-task code for backwards compat
      if (false && expiryWarning === "expiring_soon" && form.id_expiry) {
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
      {/* Residency — auto-detected from nationality, or ask if not set */}
      {nationality ? (
        <div className="rounded-lg border border-[#006b5f]/20 bg-[#006b5f]/5 p-3 flex items-center gap-3">
          <span className="material-symbols-outlined text-[#006b5f] text-[20px]">{isForeigner ? "flight" : "home"}</span>
          <div>
            <p className="text-sm font-semibold text-[#121c2a]">{nationality}</p>
            <p className="text-xs text-[#6c7a77]">
              {isForeigner ? "Passport + work pass required" : "NRIC required"}
            </p>
          </div>
        </div>
      ) : (
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
      )}

      {/* ID type — Singaporean: NRIC selector; Foreigner: always passport */}
      {residency === "SINGAPOREAN" && (
        <div>
          <Label className="block mb-2">Document Type</Label>
          <div className="grid grid-cols-2 gap-2">
            {SG_ID_TYPES.map(({ value, label }) => (
              <button key={value} type="button" onClick={() => setIdType(value)}
                className={`py-2 px-3 rounded-md text-sm font-medium border transition-colors ${
                  idType === value ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border hover:bg-accent"
                }`}>{label}</button>
            ))}
          </div>
        </div>
      )}
      {isForeigner && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-xs font-semibold text-blue-800">
            As a foreigner, you need to upload <strong>both</strong> your passport and your work pass.
          </p>
        </div>
      )}

      {/* Front photo */}
      <div>
        <Label className="block mb-2">
          {isForeigner ? "Passport Photo Page" : "Front of NRIC"}{" "}
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

      {/* ── FOREIGNER: Pass Details (in addition to passport) ── */}
      {isForeigner && (
        <div className="border-t border-border pt-5 mt-5 space-y-4">
          <div>
            <Label className="block mb-2 text-base font-semibold">Work Pass / Permit</Label>
            <p className="text-xs text-muted-foreground mb-3">Upload your valid work pass in addition to your passport above.</p>
          </div>

          {/* Pass type selector */}
          <div>
            <Label className="block mb-2">Pass Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {PASS_TYPES.map(({ value, label }) => (
                <button key={value} type="button" onClick={() => setPassType(value)}
                  className={`py-2 px-3 rounded-md text-sm font-medium border transition-colors ${
                    passType === value ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border hover:bg-accent"
                  }`}>{label}</button>
              ))}
            </div>
          </div>

          {/* Pass photo upload */}
          <div>
            <Label className="block mb-2">Pass Photo <span className="text-muted-foreground font-normal">(required)</span></Label>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={() => passInputRef.current?.click()}>
                {passFile ? "Change" : "Upload Pass"}
              </Button>
              <input ref={passInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPassFile(f); setPassPreview(URL.createObjectURL(f)); } }} />
              {passPreview && <img src={passPreview} alt="Pass" className="h-16 w-24 object-cover rounded border" />}
            </div>
          </div>

          {/* Pass number + expiry */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pass_number">Pass Number <span className="text-red-500">*</span></Label>
              <Input id="pass_number" value={passNumber} onChange={(e) => setPassNumber(e.target.value)}
                placeholder="e.g. WP1234567" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pass_expiry">Pass Expiry Date <span className="text-red-500">*</span></Label>
              <Input id="pass_expiry" type="date" value={passExpiry} onChange={(e) => setPassExpiry(e.target.value)} required />
            </div>
          </div>

          {/* Pass expiry warnings */}
          {passExpiryWarning === "expired" && (
            <div className="rounded-xl border-2 border-red-500 bg-red-50 p-4 flex items-start gap-3">
              <span className="material-symbols-outlined text-red-600 text-[24px] shrink-0 mt-0.5">error</span>
              <div>
                <p className="text-sm font-bold text-red-800">Pass Expired</p>
                <p className="text-xs text-red-700 mt-1">Your {passType.replace(/_/g, " ")} has expired. You cannot proceed with an expired pass. Please contact your employer for renewal.</p>
              </div>
            </div>
          )}
          {passExpiryWarning === "expiring_soon" && (
            <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 flex items-start gap-3">
              <span className="material-symbols-outlined text-amber-600 text-[24px] shrink-0 mt-0.5">warning</span>
              <div>
                <p className="text-sm font-bold text-amber-800">Pass Expiring Soon</p>
                <p className="text-xs text-amber-700 mt-1">Your {passType.replace(/_/g, " ")} expires on {new Date(passExpiry).toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" })}. Please ensure you renew it. Management will be notified.</p>
              </div>
            </div>
          )}
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
