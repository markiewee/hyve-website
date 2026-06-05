// src/components/portal/leads/AddLeadModal.jsx
// Manual lead capture — for prospects that come in by phone, walk-in, referral,
// or any channel the auto-sweep didn't catch. Writes a fresh row to public.leads
// (status defaults to "new") so it lands on the Kanban immediately.
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const PROPERTY_OPTIONS = ["CP", "IH", "TG"];
const ROOM_TYPE_OPTIONS = [
  { value: "master", label: "Master" },
  { value: "premium", label: "Premium" },
  { value: "standard", label: "Standard" },
];
const SOURCE_OPTIONS = [
  "manual",
  "whatsapp_direct",
  "referral",
  "roomies",
  "carousell",
  "propertyguru",
  "facebook",
  "telegram",
  "airbnb",
  "organic",
  "other",
];
const TENANT_TYPE_OPTIONS = [
  { value: "", label: "—" },
  { value: "single", label: "Single" },
  { value: "couple", label: "Couple" },
  { value: "group", label: "Group" },
];

function ChipGroup({ options, selected, onToggle }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const value = typeof opt === "string" ? opt : opt.value;
        const label = typeof opt === "string" ? opt : opt.label;
        const active = selected.includes(value);
        return (
          <button
            key={value}
            type="button"
            onClick={() => onToggle(value)}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
              active
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                : "bg-surface border-border text-foreground-variant hover:bg-white/5"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

const EMPTY = {
  name: "",
  phone: "",
  email: "",
  source: "manual",
  prospect_summary: "",
  notes: "",
  intent: { properties: [], room_types: [], budget_max: null, move_in: null, tenant_type: null },
};

export function AddLeadModal({ open, onOpenChange, onCreate }) {
  const [draft, setDraft] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const intent = draft.intent || {};

  function patchIntent(patch) {
    setDraft((d) => ({ ...d, intent: { ...(d.intent || {}), ...patch } }));
  }
  function toggleArray(key, value) {
    const current = intent[key] || [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    patchIntent({ [key]: next });
  }

  function reset() {
    setDraft(EMPTY);
    setErr(null);
  }

  async function handleSave() {
    if (!draft.name?.trim()) {
      setErr("Name is required.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      // Strip empty intent so we don't write a noisy blob.
      const cleanIntent = Object.fromEntries(
        Object.entries(intent).filter(([, v]) =>
          Array.isArray(v) ? v.length > 0 : v !== null && v !== "" && v !== undefined
        )
      );
      await onCreate({
        name: draft.name.trim(),
        phone: draft.phone?.trim() || null,
        email: draft.email?.trim() || null,
        source: draft.source || "manual",
        prospect_summary: draft.prospect_summary?.trim() || null,
        notes: draft.notes?.trim() || null,
        intent: Object.keys(cleanIntent).length ? cleanIntent : null,
      });
      reset();
      onOpenChange(false);
    } catch (e) {
      setErr(e.message || "Failed to create lead.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <SheetContent className="w-[520px] sm:max-w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add lead</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4 px-4 pb-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-foreground-variant block mb-1">Name *</label>
              <input
                className="w-full border rounded px-2 py-1.5 text-sm"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Prospect name"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-foreground-variant block mb-1">Phone</label>
              <input
                className="w-full border rounded px-2 py-1.5 text-sm"
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                placeholder="+65 …"
              />
            </div>
            <div>
              <label className="text-xs text-foreground-variant block mb-1">Email</label>
              <input
                type="email"
                className="w-full border rounded px-2 py-1.5 text-sm"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                placeholder="optional"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-foreground-variant block mb-1">Source</label>
              <select
                className="w-full border rounded px-2 py-1.5 text-sm"
                value={draft.source}
                onChange={(e) => setDraft({ ...draft, source: e.target.value })}
              >
                {SOURCE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3 border-t border-border pt-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-foreground-variant">
              What they're after
            </div>

            <div>
              <label className="text-xs text-foreground-variant block mb-1">Location / property</label>
              <ChipGroup
                options={PROPERTY_OPTIONS}
                selected={intent.properties || []}
                onToggle={(v) => toggleArray("properties", v)}
              />
            </div>

            <div>
              <label className="text-xs text-foreground-variant block mb-1">Room type</label>
              <ChipGroup
                options={ROOM_TYPE_OPTIONS}
                selected={intent.room_types || []}
                onToggle={(v) => toggleArray("room_types", v)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-foreground-variant block mb-1">Budget max (SGD/mo)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  value={intent.budget_max ?? ""}
                  onChange={(e) =>
                    patchIntent({ budget_max: e.target.value === "" ? null : Number(e.target.value) })
                  }
                  placeholder="1500"
                />
              </div>
              <div>
                <label className="text-xs text-foreground-variant block mb-1">Move-in date</label>
                <input
                  type="date"
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  value={intent.move_in || ""}
                  onChange={(e) => patchIntent({ move_in: e.target.value || null })}
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-foreground-variant block mb-1">Tenant type</label>
              <select
                className="w-full border rounded px-2 py-1.5 text-sm"
                value={intent.tenant_type || ""}
                onChange={(e) => patchIntent({ tenant_type: e.target.value || null })}
              >
                {TENANT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-foreground-variant block mb-1">Prospect summary</label>
            <Textarea
              rows={3}
              value={draft.prospect_summary}
              onChange={(e) => setDraft({ ...draft, prospect_summary: e.target.value })}
              placeholder="Couple, ~1500 budget, eyeing CP master, July move-in, cat owner."
            />
          </div>

          <div>
            <label className="text-xs text-foreground-variant block mb-1">Notes</label>
            <Textarea
              rows={3}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </div>

          {err && (
            <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/25 rounded px-3 py-2">
              {err}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Adding…" : "Add lead"}
            </Button>
            <Button variant="ghost" onClick={() => { reset(); onOpenChange(false); }}>
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
