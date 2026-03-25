import { useRef, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { Button } from "../ui/button";

const CONDITIONS = ["Good", "Fair", "Damaged"];

const ROOM_ITEMS = [
  "Bed & Mattress",
  "Wardrobe / Closet",
  "Desk & Chair",
  "Light Fixtures",
  "Air Conditioning",
  "Power Outlets",
  "Walls & Ceiling",
  "Flooring",
  "Door & Lock",
  "Window & Curtains",
];

const BATHROOM_ITEMS = [
  "Shower / Water Heater",
  "Toilet & Flush",
  "Sink & Tap",
  "Mirror & Cabinet",
  "Tiles & Grouting",
  "Door & Lock",
];

function getAreasForRoom(roomName) {
  const isMaster = (roomName || "").toLowerCase().includes("master");
  const areas = [{ name: "Your Room", items: ROOM_ITEMS }];
  if (isMaster) {
    areas.push({ name: "Attached Bathroom", items: BATHROOM_ITEMS });
  }
  return areas;
}

function buildInitialAreas(roomName) {
  return getAreasForRoom(roomName).map((area) => ({
    name: area.name,
    items: area.items.map((item) => ({ name: item, condition: "Good", notes: "" })),
    photos: [],
    photoUrls: [],
  }));
}

export default function RoomChecklistForm({ onboarding, advanceStep }) {
  const { profile } = useAuth();
  const roomName = profile?.rooms?.name || "";
  const fileInputRefs = useRef({});
  const [areas, setAreas] = useState(() => buildInitialAreas(roomName));
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

  function updateItem(areaIndex, itemIndex, field, value) {
    setAreas((prev) => {
      const next = [...prev];
      const items = [...next[areaIndex].items];
      items[itemIndex] = { ...items[itemIndex], [field]: value };
      next[areaIndex] = { ...next[areaIndex], items };
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

      // Flatten items into the areas format for storage
      const formattedAreas = areasWithUrls.map(a => ({
        ...a,
        items: undefined, // remove items array from upload result
      }));

      // Insert checklist row
      const { error: insertError } = await supabase
        .from("room_checklists")
        .insert({
          tenant_profile_id: profile.id,
          room_id: profile.room_id,
          checklist_type: "MOVE_IN",
          areas: areas.map((area, i) => ({
            name: area.name,
            items: area.items.map(item => ({
              name: item.name,
              condition: item.condition,
              notes: item.notes.trim() || null,
            })),
            photo_urls: formattedAreas[i]?.photo_urls || [],
          })),
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
        Check each item in your room and note its condition. Take photos of any existing damage — this protects your deposit.
      </p>

      {areas.map((area, areaIndex) => (
        <div
          key={area.name}
          className="border border-border rounded-lg overflow-hidden"
        >
          <div className="bg-[#006b5f]/5 px-4 py-3 border-b border-border">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span className="material-symbols-outlined text-[#006b5f] text-[18px]">
                {area.name.includes("Bathroom") ? "bathroom" : "bed"}
              </span>
              {area.name}
              {roomName && <span className="text-xs font-normal text-muted-foreground">— {roomName}</span>}
            </h3>
          </div>

          <div className="divide-y divide-border">
            {area.items.map((item, itemIndex) => (
              <div key={item.name} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                <p className="text-sm text-foreground font-medium min-w-[160px]">{item.name}</p>
                <div className="flex gap-1.5 flex-1">
                  {CONDITIONS.map((cond) => (
                    <button
                      key={cond}
                      type="button"
                      onClick={() => updateItem(areaIndex, itemIndex, "condition", cond)}
                      className={`py-1 px-2.5 rounded text-[11px] font-semibold border transition-colors ${
                        item.condition === cond
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
                {item.condition !== "Good" && (
                  <input
                    type="text"
                    value={item.notes}
                    onChange={(e) => updateItem(areaIndex, itemIndex, "notes", e.target.value)}
                    placeholder="Describe issue..."
                    className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Photos for this area */}
          <div className="px-4 py-3 bg-[#f8f9ff] border-t border-border">
            <label className="block text-xs text-muted-foreground mb-1.5">
              Photos of {area.name.toLowerCase()}{" "}
              <span className="text-muted-foreground/60">(optional — recommended for any damage)</span>
            </label>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => handlePhotos(areaIndex, e.target.files)}
              ref={(el) => { fileInputRefs.current[areaIndex] = el; }}
              className="block w-full text-xs text-muted-foreground file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/80"
            />
            {area.photos.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {area.photos.length} photo{area.photos.length > 1 ? "s" : ""} selected
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
