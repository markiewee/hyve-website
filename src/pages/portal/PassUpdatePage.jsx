import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { needsBackImage, passLabel, passStatus } from "../../lib/idDocuments";

const PASS_TYPES = [
  { value: "WORK_PERMIT", label: "Work Permit" },
  { value: "EMPLOYMENT_PASS", label: "Employment Pass" },
  { value: "S_PASS", label: "S Pass" },
  { value: "STUDENT_PASS", label: "Student Pass" },
  { value: "DEPENDANT_PASS", label: "Dependant Pass" },
  { value: "LONG_TERM_VISIT_PASS", label: "Long Term Visit Pass (LTVP)" },
  { value: "IPA", label: "In-Principle Approval (IPA)" },
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
        (blob) => (blob ? resolve(blob) : reject(new Error("Compression failed"))),
        "image/jpeg",
        quality
      );
    };
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Renewing a pass, on its own page.
 *
 * Onboarding already collects this, but IdScanForm is the whole identity step:
 * residency, passport, OCR, the lot. A tenant whose Student Pass ran out has
 * not changed nationality and does not need to re-photograph their passport,
 * so sending them back through that is the sort of thing that makes people
 * give up halfway. This asks only for what actually changed.
 */
export default function PassUpdatePage() {
  const { profile, setProfile } = useAuth();
  const navigate = useNavigate();
  const td = profile?.tenant_details || {};
  const status = passStatus(td);

  const [passType, setPassType] = useState(td.pass_type || "WORK_PERMIT");
  const [passNumber, setPassNumber] = useState(td.pass_number || "");
  const [passExpiry, setPassExpiry] = useState(td.pass_expiry || "");
  const [frontFile, setFrontFile] = useState(null);
  const [backFile, setBackFile] = useState(null);
  const [frontPreview, setFrontPreview] = useState(null);
  const [backPreview, setBackPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const frontRef = useRef(null);
  const backRef = useRef(null);

  const needsBack = needsBackImage({ kind: "PASS", type: passType });
  const label = passLabel(passType);

  async function upload(file, side) {
    const compressed = await compressImage(file);
    const path = `tenants/${profile.id}/id-pass-${side}-${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("tenant-documents")
      .upload(path, compressed, { contentType: "image/jpeg", upsert: true });
    if (uploadError) throw uploadError;
    const { data, error: signErr } = await supabase.storage
      .from("tenant-documents")
      .createSignedUrl(path, 3600);
    if (signErr) throw signErr;
    return data.signedUrl;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!passNumber.trim()) return setError("Pass number is required.");
    if (!passExpiry) return setError("Pass expiry date is required.");
    if (!frontFile) {
      return setError(
        needsBack
          ? `Please upload a photo of the front of your renewed ${label}.`
          : `Please upload your renewed ${label}.`
      );
    }
    if (needsBack && !backFile) {
      return setError(`Please upload a photo of the back of your renewed ${label}. Both sides are required.`);
    }
    // A renewal that is already expired is not a renewal. Catching it here
    // saves the tenant a round trip through an admin telling them the same.
    if (passStatus({ pass_type: passType, pass_expiry: passExpiry }).state === "EXPIRED") {
      return setError("That expiry date has already passed. Please upload your current, valid pass.");
    }

    setError(null);
    setSubmitting(true);
    try {
      const frontUrl = await upload(frontFile, "front");
      const backUrl = needsBack && backFile ? await upload(backFile, "back") : null;

      const { error: updateError } = await supabase
        .from("tenant_details")
        .update({
          pass_type: passType,
          pass_number: passNumber.trim(),
          pass_expiry: passExpiry,
          pass_url: frontUrl,
          pass_back_url: backUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_profile_id", profile.id);
      if (updateError) throw updateError;

      // Somebody has to actually look at it. Without this the tenant does
      // their part and the document sits unchecked in a bucket.
      try {
        await supabase.from("admin_tasks").insert({
          title: `Pass renewed: ${td.full_name || profile.email}`,
          description: `${td.full_name || profile.email} uploaded a renewed ${label} (${passNumber.trim()}) expiring ${passExpiry}. Check the images match the details before marking the compliance file clear.`,
          category: "ONBOARDING",
          priority: "HIGH",
          status: "PENDING",
          tenant_name: td.full_name || null,
          due_date: new Date().toISOString().slice(0, 10),
        });
      } catch (taskErr) {
        // Never block the tenant on our own queue.
        console.error("[pass-update] admin task insert failed:", taskErr);
      }

      // Update the profile in place so the banner clears on the way out
      // instead of following the tenant to the dashboard they just fixed.
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              tenant_details: {
                ...(prev.tenant_details || {}),
                pass_type: passType,
                pass_number: passNumber.trim(),
                pass_expiry: passExpiry,
                pass_url: frontUrl,
                pass_back_url: backUrl,
              },
            }
          : prev
      );
      toast.success("Pass updated. Thank you.");
      navigate("/portal/dashboard");
    } catch (err) {
      console.error("[pass-update]", err);
      setError(err.message || "Could not save your pass. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PortalLayout>
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Update your pass</h1>
        <p className="mt-2 text-muted-foreground">
          {status.state === "EXPIRED"
            ? `Your ${passLabel(status.type)} has expired. Upload your renewed one and we will update your file.`
            : status.state === "MISSING"
              ? "We are missing the details of your pass. Please fill them in and upload a photo."
              : "Upload your renewed pass so your file stays current."}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <Label className="block mb-2">Pass type</Label>
            <div className="grid grid-cols-2 gap-2">
              {PASS_TYPES.map(({ value, label: optLabel }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPassType(value)}
                  className={`py-2 px-3 rounded-md text-sm font-medium border transition-colors ${
                    passType === value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-accent"
                  }`}
                >
                  {optLabel}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pass_number">Pass number</Label>
              <Input
                id="pass_number"
                value={passNumber}
                onChange={(e) => setPassNumber(e.target.value)}
                placeholder="e.g. WP1234567"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pass_expiry">New expiry date</Label>
              <Input
                id="pass_expiry"
                type="date"
                value={passExpiry}
                onChange={(e) => setPassExpiry(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <Label className="block mb-2">{needsBack ? "Front of pass" : "Pass document"}</Label>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={() => frontRef.current?.click()}>
                {frontFile ? "Change" : "Upload"}
              </Button>
              <input
                ref={frontRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFrontFile(f);
                    setFrontPreview(URL.createObjectURL(f));
                  }
                }}
              />
              {frontPreview && (
                <img src={frontPreview} alt="Pass front" className="h-16 w-24 object-cover rounded border border-border" />
              )}
            </div>
          </div>

          {needsBack && (
            <div>
              <Label className="block mb-2">Back of pass</Label>
              <p className="text-xs text-muted-foreground mb-2">
                The side with your employer or school and the pass details.
              </p>
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" onClick={() => backRef.current?.click()}>
                  {backFile ? "Change" : "Upload"}
                </Button>
                <input
                  ref={backRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setBackFile(f);
                      setBackPreview(URL.createObjectURL(f));
                    }
                  }}
                />
                {backPreview && (
                  <img src={backPreview} alt="Pass back" className="h-16 w-24 object-cover rounded border border-border" />
                )}
              </div>
            </div>
          )}

          {error && (
            <div role="alert" className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
            {submitting ? "Uploading" : "Save pass"}
          </Button>
        </form>
      </div>
    </PortalLayout>
  );
}
