// src/components/portal/leads/LeadDrawer.jsx
import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const STATUSES = [
  "new",
  "qualified",
  "viewing_booked",
  "viewed",
  "viewing_done",
  "agreement_sent",
  "signed",
  "closed_won",
  "lost",
  "closed_lost",
  "cold",
];

const PROPERTY_OPTIONS = ["CP", "IH", "TG"];
const ROOM_TYPE_OPTIONS = [
  { value: "master", label: "Master" },
  { value: "premium", label: "Premium" },
  { value: "standard", label: "Standard" },
];
const TENANT_TYPE_OPTIONS = [
  { value: "", label: "—" },
  { value: "single", label: "Single" },
  { value: "couple", label: "Couple" },
  { value: "group", label: "Group" },
];
const LEASE_OPTIONS = [
  { value: "", label: "—" },
  { value: 3, label: "3 months" },
  { value: 6, label: "6 months" },
  { value: 9, label: "9 months" },
  { value: 12, label: "12+ months" },
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
                ? "bg-emerald-100 border-emerald-400 text-emerald-800"
                : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function LeadDrawer({ lead, open, onOpenChange, onSave }) {
  const [draft, setDraft] = useState(lead || {});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (lead) setDraft(lead);
  }, [lead]);

  if (!lead) return null;

  const beeperLink = `/open/${encodeURIComponent(lead.chat_id || "")}`;
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

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(draft);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[520px] sm:max-w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {lead.name || "(no name)"} {lead.phone ? `— ${lead.phone}` : ""}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4 px-4 pb-6">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Status</label>
            <select
              className="w-full border rounded px-2 py-1.5 text-sm"
              value={draft.status || "new"}
              onChange={(e) => setDraft({ ...draft, status: e.target.value })}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1">
              Prospect summary <span className="text-slate-400">(AI-gleaned, editable)</span>
            </label>
            <Textarea
              rows={3}
              value={draft.prospect_summary || ""}
              onChange={(e) => setDraft({ ...draft, prospect_summary: e.target.value })}
              placeholder="Couple, ~1500 budget, eyeing CP master, July move-in, cat owner."
            />
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1">
              Matched rooms (comma-separated)
            </label>
            <input
              className="w-full border rounded px-2 py-1.5 text-sm"
              value={(draft.matched_room_codes || []).join(", ")}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  matched_room_codes: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="IH-PR3, TG-STD1"
            />
          </div>

          <div className="space-y-3 border-t border-slate-200 pt-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Intent
            </div>

            <div>
              <label className="text-xs text-slate-500 block mb-1">Property</label>
              <ChipGroup
                options={PROPERTY_OPTIONS}
                selected={intent.properties || []}
                onToggle={(v) => toggleArray("properties", v)}
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 block mb-1">Room type</label>
              <ChipGroup
                options={ROOM_TYPE_OPTIONS}
                selected={intent.room_types || []}
                onToggle={(v) => toggleArray("room_types", v)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">
                  Budget max (SGD/mo)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  value={intent.budget_max ?? ""}
                  onChange={(e) =>
                    patchIntent({
                      budget_max: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  placeholder="1500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Move-in date</label>
                <input
                  type="date"
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  value={intent.move_in || ""}
                  onChange={(e) => patchIntent({ move_in: e.target.value || null })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Tenant type</label>
                <select
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  value={intent.tenant_type || ""}
                  onChange={(e) =>
                    patchIntent({ tenant_type: e.target.value || null })
                  }
                >
                  {TENANT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Lease length</label>
                <select
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  value={intent.lease_months ?? ""}
                  onChange={(e) =>
                    patchIntent({
                      lease_months:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                >
                  {LEASE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={!!intent.pets_cat}
                onChange={(e) => patchIntent({ pets_cat: e.target.checked })}
              />
              Has a cat
            </label>
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1">Notes</label>
            <Textarea
              rows={4}
              value={draft.notes || ""}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </div>

          <div className="text-xs text-slate-500 border-t pt-3">
            <div>Source: <span className="text-slate-700">{lead.source || "—"}</span></div>
            <div>
              Last message:{" "}
              <span className="text-slate-700">{lead.last_message_excerpt || "—"}</span>
            </div>
            {lead.chat_id && (
              <div>chat_id: <span className="text-slate-700 font-mono">{lead.chat_id}</span></div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            {lead.chat_id && (
              <Button variant="outline" asChild>
                <a href={beeperLink} target="_blank" rel="noreferrer">
                  Open in Beeper
                </a>
              </Button>
            )}
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
