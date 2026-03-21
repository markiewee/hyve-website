import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";

export default function PersonalDetailsForm({ onboarding, advanceStep }) {
  const { profile } = useAuth();

  const [form, setForm] = useState({
    full_name: "",
    phone: "+65 ",
    nationality: "",
    date_of_birth: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.full_name.trim()) {
      setError("Full name is required.");
      return;
    }
    if (!form.phone.trim()) {
      setError("Phone number is required.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const { error: upsertError } = await supabase
        .from("tenant_details")
        .upsert(
          {
            tenant_profile_id: profile.id,
            full_name: form.full_name.trim(),
            phone: form.phone.trim(),
            nationality: form.nationality.trim() || null,
            date_of_birth: form.date_of_birth || null,
            emergency_contact_name: form.emergency_contact_name.trim() || null,
            emergency_contact_phone:
              form.emergency_contact_phone.trim() || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_profile_id" }
        );

      if (upsertError) throw upsertError;

      await advanceStep("personal_details_completed_at");
    } catch (err) {
      console.error("Error saving personal details:", err);
      setError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="full_name">Full Name</Label>
          <Input
            id="full_name"
            name="full_name"
            value={form.full_name}
            onChange={handleChange}
            placeholder="As per NRIC / Passport"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="+65 9123 4567"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="nationality">Nationality</Label>
          <Input
            id="nationality"
            name="nationality"
            value={form.nationality}
            onChange={handleChange}
            placeholder="e.g. Singaporean"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="date_of_birth">Date of Birth</Label>
          <Input
            id="date_of_birth"
            name="date_of_birth"
            type="date"
            value={form.date_of_birth}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="emergency_contact_name">Emergency Contact Name</Label>
          <Input
            id="emergency_contact_name"
            name="emergency_contact_name"
            value={form.emergency_contact_name}
            onChange={handleChange}
            placeholder="Name of next-of-kin"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="emergency_contact_phone">
            Emergency Contact Phone
          </Label>
          <Input
            id="emergency_contact_phone"
            name="emergency_contact_phone"
            value={form.emergency_contact_phone}
            onChange={handleChange}
            placeholder="+65 9123 4567"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
        {submitting ? "Saving…" : "Save & Continue"}
      </Button>
    </form>
  );
}
