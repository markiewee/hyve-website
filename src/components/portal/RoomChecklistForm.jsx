import { useRef, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { Button } from "../ui/button";

const AREAS = ["Bedroom", "Bathroom", "Kitchen", "Living Room", "Common Areas"];
const CONDITIONS = ["Good", "Fair", "Damaged"];

function buildInitialAreas() {
  return AREAS.map((name) => ({
    name,
    condition: "Good",
    notes: "",
    photos: [],
    photoUrls: [],
  }));
}

export default function RoomChecklistForm({ onboarding, advanceStep }) {
  const { profile } = useAuth();
  const fileInputRefs = useRef({});
  const [areas, setAreas] = useState(buildInitialAreas);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [error, setError] = useState(null);

  function updateArea(index, field, value) {
    setAreas((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  async function handlePhotos(index, files) {
    if (!files?.length) return;
    const fileArr = Array.from(files);
    updateArea(index, "photos", fileArr);
  }

  async function uploadAreaPhotos(areaName, files) {
    const urls = [];
    for (const file of files) {
      const timestamp = Date.now();
      const safeName = areaName.toLowerCase().replace(/\s+/g, "-");
      const path = `checklists/${profile.id}/${safeName}-${timestamp}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("tenant-documents")
        .upload(path, file, { upsert: true });

      if (uploadError) {
        console.error(`Upload failed for ${areaName}:`, uploadError);
        continue;
      }

      const { data } = supabase.storage
        .from("tenant-documents")
        .getPublicUrl(path);

      urls.push(data.publicUrl);
    }
    return urls;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // Upload all photos first
      const areasWithUrls = await Promise.all(
        areas.map(async (area, i) => {
          setUploadProgress((prev) => ({ ...prev, [area.name]: "uploading" }));
          const photoUrls =
            area.photos.length > 0
              ? await uploadAreaPhotos(area.name, area.photos)
              : [];
          setUploadProgress((prev) => ({ ...prev, [area.name]: "done" }));
          return {
            name: area.name,
            condition: area.condition,
            notes: area.notes.trim() || null,
            photo_urls: photoUrls,
          };
        })
      );

      // Insert checklist row
      const { error: insertError } = await supabase
        .from("room_checklists")
        .insert({
          tenant_profile_id: profile.id,
          room_id: profile.room_id,
          checklist_type: "MOVE_IN",
          areas: areasWithUrls,
          completed_at: new Date().toISOString(),
        });

      if (insertError) throw insertError;

      // Advance to ACTIVE
      await advanceStep("checklist_completed_at");
    } catch (err) {
      console.error("Checklist submission failed:", err);
      setError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
      setUploadProgress({});
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Record the condition of each area at move-in. This protects both you
        and Hyve.
      </p>

      {areas.map((area, index) => (
        <div
          key={area.name}
          className="border border-border rounded-md p-4 space-y-3"
        >
          <h3 className="text-sm font-semibold text-foreground">{area.name}</h3>

          {/* Condition selector */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">
              Condition
            </label>
            <div className="flex gap-2">
              {CONDITIONS.map((cond) => (
                <button
                  key={cond}
                  type="button"
                  onClick={() => updateArea(index, "condition", cond)}
                  className={`py-1 px-3 rounded text-xs font-medium border transition-colors ${
                    area.condition === cond
                      ? cond === "Good"
                        ? "bg-green-500 text-white border-green-500"
                        : cond === "Fair"
                        ? "bg-amber-500 text-white border-amber-500"
                        : "bg-red-500 text-white border-red-500"
                      : "bg-background text-foreground border-border hover:bg-accent"
                  }`}
                >
                  {cond}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor={`notes-${index}`}
              className="block text-xs text-muted-foreground mb-1"
            >
              Notes{" "}
              <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <textarea
              id={`notes-${index}`}
              rows={2}
              value={area.notes}
              onChange={(e) => updateArea(index, "notes", e.target.value)}
              placeholder="Any existing damage or notes…"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Photos */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              Photos{" "}
              <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => handlePhotos(index, e.target.files)}
              ref={(el) => {
                fileInputRefs.current[index] = el;
              }}
              className="block w-full text-xs text-muted-foreground file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/80"
            />
            {area.photos.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {area.photos.length} photo
                {area.photos.length > 1 ? "s" : ""} selected
                {uploadProgress[area.name] === "uploading" && " — uploading…"}
                {uploadProgress[area.name] === "done" && " — uploaded"}
              </p>
            )}
          </div>
        </div>
      ))}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button
        type="submit"
        disabled={submitting}
        className="w-full sm:w-auto"
      >
        {submitting ? "Submitting…" : "Submit Move-In Checklist"}
      </Button>
    </form>
  );
}
