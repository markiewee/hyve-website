import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";

const CATEGORIES = ["AC", "PLUMBING", "ELECTRICAL", "FURNITURE", "CLEANING", "OTHER"];
const LOCATIONS = ["My Room", "Kitchen", "Living Room", "Bathroom (Shared)", "Corridor", "Laundry Area", "Other"];

export default function TicketForm() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [category, setCategory] = useState(null);
  const [location, setLocation] = useState("My Room");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

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

    setError(null);
    setSubmitting(true);

    try {
      // 1. Insert the ticket
      const { data: ticket, error: insertError } = await supabase
        .from("maintenance_tickets")
        .insert({
          room_id: profile.room_id,
          property_id: profile.rooms?.property_id ?? profile.room?.property_id ?? null,
          reported_by: user.id,
          category,
          description: `[${location}] ${description.trim()}`,
          status: "OPEN",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 2. Upload photos and insert ticket_photos rows
      if (photos.length > 0) {
        await Promise.all(
          Array.from(photos).map(async (file) => {
            const timestamp = Date.now();
            const path = `tickets/${ticket.id}/${timestamp}-${file.name}`;

            const { error: uploadError } = await supabase.storage
              .from("ticket-photos")
              .upload(path, file);

            if (uploadError) {
              console.error("Photo upload failed:", uploadError);
              return; // Don't block the whole submission for a photo error
            }

            const { data: urlData } = supabase.storage
              .from("ticket-photos")
              .getPublicUrl(path);

            await supabase.from("ticket_photos").insert({
              ticket_id: ticket.id,
              url: urlData.publicUrl,
              storage_path: path,
            });
          })
        );
      }

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
          Photos <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <input
          id="photos"
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => setPhotos(e.target.files)}
          className="block w-full text-sm text-muted-foreground file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/80"
        />
        {photos.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            {photos.length} file{photos.length > 1 ? "s" : ""} selected
          </p>
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
        className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? "Submitting…" : "Submit Issue"}
      </button>
    </form>
  );
}
