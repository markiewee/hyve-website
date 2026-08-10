import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { notifyTicketStatusChange } from "../../lib/notify";

const CATEGORIES = ["AC", "PLUMBING", "ELECTRICAL", "FURNITURE", "CLEANING", "OTHER"];
const SHARED_LOCATIONS = ["Kitchen", "Living Room", "Bathroom (Shared)", "Corridor", "Laundry Area", "Other"];
const MAX_PHOTOS = 5;

// The ticket-photos bucket only allows image/* MIME types. Android galleries
// often hand us a File with an empty or "application/octet-stream" type, which
// the bucket rejects (415). Derive a concrete image content-type from the file
// extension so the upload always carries a valid image/* header.
const EXT_MIME = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  gif: "image/gif",
  bmp: "image/bmp",
};

function resolveImageContentType(file) {
  if (file.type && file.type.startsWith("image/")) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return EXT_MIME[ext] || "image/jpeg";
}

// supabase-js uploads a File/Blob via multipart FormData and takes the part's
// content-type from the Blob's own .type, the `contentType` upload option is
// IGNORED for File bodies. So when the type is missing/wrong we must re-wrap the
// bytes into a new File that carries a valid image/* type, or the image/*-only
// bucket rejects it with 415.
function toTypedImageFile(file) {
  if (file.type && file.type.startsWith("image/")) return file;
  return new File([file], file.name, { type: resolveImageContentType(file) });
}

function isHeic(file) {
  const t = (file.type || "").toLowerCase();
  const ext = file.name.split(".").pop()?.toLowerCase();
  return t === "image/heic" || t === "image/heif" || ext === "heic" || ext === "heif";
}

// iPhones save photos as HEIC by default. iOS Safari can render HEIC, but
// Chrome / Firefox / most admin browsers cannot, admins would see broken
// thumbnails. Convert HEIC to JPEG client-side before upload so the photo is
// viewable everywhere. heic2any is dynamically imported so the ~1MB libheif
// WASM payload only loads when an iOS user actually picks a HEIC file.
async function convertHeicToJpeg(file) {
  const { default: heic2any } = await import("heic2any");
  const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  const jpegBlob = Array.isArray(result) ? result[0] : result;
  const newName = file.name.replace(/\.(heic|heif)$/i, ".jpg");
  return new File([jpegBlob], newName, { type: "image/jpeg" });
}

async function prepareForUpload(file) {
  if (isHeic(file)) {
    try {
      return await convertHeicToJpeg(file);
    } catch (e) {
      console.error("HEIC conversion failed, uploading original:", e);
      // Fall through to the typed-file path so we at least preserve the upload.
    }
  }
  return toTypedImageFile(file);
}

export default function TicketForm({ preselectedCategory = null }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  // Use the resident's actual room code as the "My Room" option so the
  // ticket prefix says e.g. [CP-STD1] instead of generic [My Room].
  const myRoomLabel = profile?.rooms?.unit_code || profile?.room?.unit_code || "My Room";
  const LOCATIONS = [myRoomLabel, ...SHARED_LOCATIONS];

  const [category, setCategory] = useState(preselectedCategory);
  const [location, setLocation] = useState(myRoomLabel);
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [photoNotice, setPhotoNotice] = useState(null);

  function handlePhotoChange(e) {
    const picked = Array.from(e.target.files || []);
    if (picked.length > MAX_PHOTOS) {
      setPhotoNotice(`Only the first ${MAX_PHOTOS} photos will be used (you selected ${picked.length}).`);
    } else {
      setPhotoNotice(null);
    }
    setPhotos(picked.slice(0, MAX_PHOTOS));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!category) {
      setError("Please select a category.");
      return;
    }
    if (!description.trim()) {
      setError("Please describe the issue.");
      return;
    }
    if (photos.length === 0) {
      setError("At least one photo is required so the handyman knows what to fix.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      // 1. Upload photos to storage FIRST. We deliberately do not create the
      //    ticket until at least one photo is secured, tenants can't DELETE a
      //    ticket (RLS), so an insert-then-rollback approach leaves orphan
      //    photo-less tickets whenever an upload fails. Upload-first means a
      //    failure simply aborts before any ticket row exists.
      const batchId =
        (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      const uploaded = [];
      for (const file of Array.from(photos)) {
        const prepared = await prepareForUpload(file);
        const path = `tickets/${batchId}/${Date.now()}-${prepared.name}`;
        const { error: uploadError } = await supabase.storage
          .from("ticket-photos")
          .upload(path, prepared);
        if (uploadError) {
          console.error("Photo upload failed:", uploadError);
          continue;
        }
        const { data: urlData } = supabase.storage.from("ticket-photos").getPublicUrl(path);
        uploaded.push({ path, url: urlData.publicUrl });
      }

      if (uploaded.length === 0) {
        throw new Error("Photo upload failed. Please check your connection and try again.");
      }

      // 2. Now that a photo is secured, create the ticket.
      const cleanDescription = description.trim().replace(/<[^>]*>/g, "");
      const { data: ticket, error: insertError } = await supabase
        .from("maintenance_tickets")
        .insert({
          room_id: profile.room_id,
          property_id: profile.rooms?.property_id ?? profile.room?.property_id ?? null,
          submitted_by: user.id,
          category,
          description: `[${location}] ${cleanDescription}`,
          status: "OPEN",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 3. Link the uploaded photos to the ticket.
      const { error: rowError } = await supabase.from("ticket_photos").insert(
        uploaded.map((u) => ({ ticket_id: ticket.id, url: u.url, storage_path: u.path }))
      );
      if (rowError) console.error("Photo row insert failed:", rowError);

      // Email the submitter a "we've received your request" confirmation.
      // Fire-and-forget, notify swallows its own errors, never blocks filing.
      notifyTicketStatusChange(ticket, "OPEN", null);

      navigate("/portal/issues");
    } catch (err) {
      console.error("Ticket submission failed:", err);
      setError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Category picker */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Category</label>
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`py-2 px-3 rounded-md text-sm font-medium border transition-colors ${
                category === cat
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border hover:bg-accent"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Location */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Location</label>
        <div className="flex flex-wrap gap-2">
          {LOCATIONS.map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => setLocation(loc)}
              className={`py-1.5 px-3 rounded-md text-xs font-medium border transition-colors ${
                location === loc
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border hover:bg-accent"
              }`}
            >
              {loc}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-foreground mb-2"
        >
          Description
        </label>
        <textarea
          id="description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue in detail…"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
      </div>

      {/* Photos */}
      <div>
        <label
          htmlFor="photos"
          className="block text-sm font-medium text-foreground mb-2"
        >
          Photos <span className="text-red-600 font-normal">(required, at least 1, up to {MAX_PHOTOS})</span>
        </label>
        <input
          id="photos"
          type="file"
          multiple
          required
          accept="image/*"
          onChange={handlePhotoChange}
          className="block w-full text-sm text-muted-foreground file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/80"
        />
        {photos.length > 0 ? (
          <p className="text-xs text-muted-foreground mt-1">
            {photos.length} of {MAX_PHOTOS} file{photos.length > 1 ? "s" : ""} selected
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-1">
            Snap a photo of the issue so the handyman knows exactly what to fix.
          </p>
        )}
        {photoNotice && (
          <p className="text-xs text-amber-600 mt-1">{photoNotice}</p>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? "Submitting…" : "Submit Issue"}
      </button>
    </form>
  );
}
