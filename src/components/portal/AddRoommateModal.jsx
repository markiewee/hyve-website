import { useState } from "react";
import { supabase } from "../../lib/supabase";

/**
 * Modal: Add Roommate to a primary tenant's room.
 *
 * Wraps the `add_roommate` Postgres RPC which:
 *   - Creates a new tenant_profiles row with is_primary=false, monthly_rent=0,
 *     room_id + property_id inherited from the primary, same lease_end.
 *   - Creates a tenant_details row with name + ID details.
 *
 * Use case: couples / partners / family members sharing one room. Only one
 * tenant pays rent; the +1 is registered for compliance (ID on file).
 *
 * Required prop: primaryTenant (the tenant_profiles row of the rent-paying
 * tenant). Calls onSuccess(newTenantId) on completion.
 */
export default function AddRoommateModal({ primaryTenant, onClose, onSuccess }) {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    id_type: "NRIC",
    id_number: "",
    nationality: "",
    moved_in_at: new Date().toISOString().slice(0, 10),
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.full_name.trim()) {
      setError("Full name required");
      return;
    }
    setSubmitting(true);
    const { data, error: rpcError } = await supabase.rpc("add_roommate", {
      p_primary_tenant_id: primaryTenant.id,
      p_full_name: form.full_name.trim(),
      p_email: form.email.trim() || null,
      p_phone: form.phone.trim() || null,
      p_id_type: form.id_type,
      p_id_number: form.id_number.trim() || null,
      p_nationality: form.nationality.trim() || null,
      p_moved_in_at: form.moved_in_at || null,
    });
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.status_msg?.startsWith("ERROR")) {
      setError(row.status_msg);
      return;
    }
    onSuccess?.(row?.new_tenant_id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-xl">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">Add Roommate</h2>
          <p className="mt-1 text-xs text-foreground-variant">
            Registers a +1 to the room. Rent stays with the primary tenant; the
            roommate is recorded for ID compliance only.
          </p>
        </div>

        {error && (
          <div className="mb-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <Field label="Full Name *" value={form.full_name} onChange={set("full_name")} />
          <Field label="Email" type="email" value={form.email} onChange={set("email")} />
          <Field label="Phone" value={form.phone} onChange={set("phone")} placeholder="+65 9123 4567" />

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-foreground-variant">ID Type</span>
              <select
                value={form.id_type}
                onChange={set("id_type")}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              >
                <option value="NRIC">NRIC</option>
                <option value="PASSPORT">Passport</option>
                <option value="FIN">FIN</option>
              </select>
            </label>
            <Field label="ID Number" value={form.id_number} onChange={set("id_number")} />
          </div>

          <Field label="Nationality" value={form.nationality} onChange={set("nationality")} />
          <Field label="Move-In Date" type="date" value={form.moved_in_at} onChange={set("moved_in_at")} />

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-border bg-background px-4 py-1.5 text-sm text-foreground hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-accent px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {submitting ? "Adding…" : "Add Roommate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, type = "text", value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-foreground-variant">{label}</span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground placeholder:text-foreground-variant"
      />
    </label>
  );
}
