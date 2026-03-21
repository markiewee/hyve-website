import { useRef, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { toast } from "sonner";

const ID_TYPES = [
  { value: "NRIC", label: "NRIC" },
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

  const [idType, setIdType] = useState("NRIC");
  const [form, setForm] = useState({ id_number: "", id_expiry: "" });
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

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.id_number.trim()) {
      setError("ID number is required.");
      return;
    }
    if (!frontFile) {
      setError("Please upload a photo of the front of your ID.");
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
    } catch (err) {
      console.error("ID verification failed:", err);
      setError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ID type selector */}
      <div>
        <Label className="block mb-2">ID Type</Label>
        <div className="grid grid-cols-2 gap-2">
          {ID_TYPES.map(({ value, label }) => (
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
          <Label htmlFor="id_number">ID Number</Label>
          <Input
            id="id_number"
            name="id_number"
            value={form.id_number}
            onChange={handleChange}
            placeholder="e.g. S1234567A"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="id_expiry">Expiry Date</Label>
          <Input
            id="id_expiry"
            name="id_expiry"
            type="date"
            value={form.id_expiry}
            onChange={handleChange}
          />
        </div>
      </div>

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
