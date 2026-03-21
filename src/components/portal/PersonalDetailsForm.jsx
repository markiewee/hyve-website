import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";

const COUNTRY_CODES = [
  { code: "+65", label: "🇸🇬 +65", country: "Singapore" },
  { code: "+60", label: "🇲🇾 +60", country: "Malaysia" },
  { code: "+62", label: "🇮🇩 +62", country: "Indonesia" },
  { code: "+63", label: "🇵🇭 +63", country: "Philippines" },
  { code: "+66", label: "🇹🇭 +66", country: "Thailand" },
  { code: "+84", label: "🇻🇳 +84", country: "Vietnam" },
  { code: "+91", label: "🇮🇳 +91", country: "India" },
  { code: "+86", label: "🇨🇳 +86", country: "China" },
  { code: "+81", label: "🇯🇵 +81", country: "Japan" },
  { code: "+82", label: "🇰🇷 +82", country: "South Korea" },
  { code: "+852", label: "🇭🇰 +852", country: "Hong Kong" },
  { code: "+886", label: "🇹🇼 +886", country: "Taiwan" },
  { code: "+44", label: "🇬🇧 +44", country: "UK" },
  { code: "+1", label: "🇺🇸 +1", country: "US/Canada" },
  { code: "+61", label: "🇦🇺 +61", country: "Australia" },
  { code: "+33", label: "🇫🇷 +33", country: "France" },
  { code: "+49", label: "🇩🇪 +49", country: "Germany" },
  { code: "+95", label: "🇲🇲 +95", country: "Myanmar" },
];

export default function PersonalDetailsForm({ onboarding, advanceStep }) {
  const { profile } = useAuth();

  const [form, setForm] = useState({
    full_name: "",
    phone_code: "+65",
    phone_number: "",
    nationality: "",
    date_of_birth: "",
    emergency_contact_name: "",
    emergency_contact_code: "+65",
    emergency_contact_number: "",
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
    if (!form.phone_number.trim()) {
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
            phone: `${form.phone_code} ${form.phone_number.trim()}`,
            nationality: form.nationality.trim() || null,
            date_of_birth: form.date_of_birth || null,
            emergency_contact_name: form.emergency_contact_name.trim() || null,
            emergency_contact_phone: form.emergency_contact_number.trim()
              ? `${form.emergency_contact_code} ${form.emergency_contact_number.trim()}`
              : null,
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
          <Label htmlFor="phone_number">Phone Number</Label>
          <div className="flex gap-1.5">
            <select
              name="phone_code"
              value={form.phone_code}
              onChange={handleChange}
              className="w-[100px] rounded-md border border-border bg-background px-2 py-2 text-sm"
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
            <Input
              id="phone_number"
              name="phone_number"
              value={form.phone_number}
              onChange={handleChange}
              placeholder="9123 4567"
              required
              className="flex-1"
            />
          </div>
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
          <Label htmlFor="emergency_contact_number">
            Emergency Contact Phone
          </Label>
          <div className="flex gap-1.5">
            <select
              name="emergency_contact_code"
              value={form.emergency_contact_code}
              onChange={handleChange}
              className="w-[100px] rounded-md border border-border bg-background px-2 py-2 text-sm"
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
            <Input
              id="emergency_contact_number"
              name="emergency_contact_number"
              value={form.emergency_contact_number}
              onChange={handleChange}
              placeholder="9123 4567"
              className="flex-1"
            />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
        {submitting ? "Saving…" : "Save & Continue"}
      </Button>
    </form>
  );
}
