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
import { evaluateReadiness, REQUIREMENTS } from "@/lib/viewingReadiness";

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
  { value: "", label: "-" },
  { value: "single", label: "Single" },
  { value: "couple", label: "Couple" },
  { value: "group", label: "Group" },
];
const LEASE_OPTIONS = [
  { value: "", label: "-" },
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
            {lead.name || "(no name)"} {lead.phone ? `${lead.phone}` : ""}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4 px-4 pb-6">
          <ViewingReadinessPanel lead={draft} />

          {/* Editable contact details */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-foreground-variant block mb-1">Name</label>
              <input
                className="w-full border rounded px-2 py-1.5 text-sm"
                value={draft.name || ""}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Prospect name"
              />
            </div>
            <div>
              <label className="text-xs text-foreground-variant block mb-1">Phone</label>
              <input
                className="w-full border rounded px-2 py-1.5 text-sm"
                value={draft.phone || ""}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                placeholder="+65 …"
              />
            </div>
            <div>
              <label className="text-xs text-foreground-variant block mb-1">Email</label>
              <input
                type="email"
                className="w-full border rounded px-2 py-1.5 text-sm"
                value={draft.email || ""}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                placeholder="optional"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-foreground-variant block mb-1">Source</label>
              <input
                className="w-full border rounded px-2 py-1.5 text-sm"
                value={draft.source || ""}
                onChange={(e) => setDraft({ ...draft, source: e.target.value })}
                placeholder="roomies, carousell, whatsapp…"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-foreground-variant block mb-1">Status</label>
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
            <label className="text-xs text-foreground-variant block mb-1">
              Prospect summary <span className="text-foreground-variant">(AI-gleaned, editable)</span>
            </label>
            <Textarea
              rows={3}
              value={draft.prospect_summary || ""}
              onChange={(e) => setDraft({ ...draft, prospect_summary: e.target.value })}
              placeholder="Couple, ~1500 budget, eyeing CP master, July move-in, cat owner."
            />
          </div>

          <div>
            <label className="text-xs text-foreground-variant block mb-1">
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

          <div className="space-y-3 border-t border-border pt-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-foreground-variant">
              Intent
            </div>

            <div>
              <label className="text-xs text-foreground-variant block mb-1">Property</label>
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
                <label className="text-xs text-foreground-variant block mb-1">
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
                <label className="text-xs text-foreground-variant block mb-1">Move-in date</label>
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
                <label className="text-xs text-foreground-variant block mb-1">Tenant type</label>
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
                <label className="text-xs text-foreground-variant block mb-1">Lease length</label>
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

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={!!intent.pets_cat}
                onChange={(e) => patchIntent({ pets_cat: e.target.checked })}
              />
              Has a cat
            </label>
          </div>

          {intent.off_horizon && (
            <OffHorizonPanel lead={lead} />
          )}

          <div>
            <label className="text-xs text-foreground-variant block mb-1">Notes</label>
            <Textarea
              rows={4}
              value={draft.notes || ""}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </div>

          <div className="text-xs text-foreground-variant border-t pt-3 space-y-1.5">
            <div>Source: <span className="text-foreground">{lead.source || "-"}</span></div>
            <div className="flex items-center gap-2">
              <label className="text-foreground-variant">Date initiated:</label>
              <input
                type="date"
                value={
                  draft.date_initiated
                    ? new Date(draft.date_initiated).toISOString().slice(0, 10)
                    : ""
                }
                onChange={(e) => {
                  const v = e.target.value;
                  setDraft({
                    ...draft,
                    date_initiated: v ? new Date(`${v}T00:00:00`).toISOString() : null,
                  });
                }}
                className="text-xs border border-border rounded px-1.5 py-0.5 text-foreground"
              />
            </div>
            <div>
              Last message:{" "}
              <span className="text-foreground">{lead.last_message_excerpt || "-"}</span>
            </div>
            {lead.chat_id && (
              <div>chat_id: <span className="text-foreground font-mono">{lead.chat_id}</span></div>
            )}
          </div>

          <div className="flex gap-2 pt-2 flex-wrap">
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
            <ArchiveMenu
              onPick={async (archiveStatus) => {
                setSaving(true);
                try {
                  await onSave({ ...draft, status: archiveStatus });
                  onOpenChange(false);
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
            />
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

const ARCHIVE_PICKS = [
  { value: "signed", label: "Mark Signed" },
  { value: "closed_won", label: "Mark Won" },
  { value: "lost", label: "Mark Lost" },
  { value: "closed_lost", label: "Archive (closed_lost)" },
];

function ArchiveMenu({ onPick, disabled }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        Archive ▾
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 bottom-full mb-1 z-40 w-48 bg-surface border border-border rounded-md py-1 text-sm">
            {ARCHIVE_PICKS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onPick(p.value);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-white/5"
              >
                {p.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function OffHorizonPanel({ lead }) {
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  const intent = lead.intent || {};
  const sentCount = intent.reminder_sent_count || 0;
  const lastSent = intent.reminder_last_sent_at;
  const dueAt = intent.reminder_due_at;

  async function fire(action) {
    setBusy(action);
    setMsg(null);
    try {
      const session = await import("@/lib/supabase").then((m) => m.supabase.auth.getSession());
      const token = session?.data?.session?.access_token || "";
      const r = await fetch(
        `/api/booking/admin-lead-reminder?id=${encodeURIComponent(lead.id)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action }),
        }
      );
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || `failed (${r.status})`);
      }
      setMsg(`${action === "snooze" ? "Snoozed 7d" : action === "bump" ? "Bumped" : "Cancelled"} ✓`);
    } catch (err) {
      setMsg(`Error: ${err.message}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-md border border-amber-500/25 bg-amber-500/10 p-3 space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wider text-amber-300">
        Off-horizon, target {intent.target_move_in_date || "?"}
      </div>
      <div className="text-xs text-amber-300">
        Sent {sentCount} reminder{sentCount === 1 ? "" : "s"}.
        {lastSent && ` Last: ${new Date(lastSent).toLocaleDateString()}.`}
        {dueAt && ` Next due: ${new Date(dueAt).toLocaleDateString()}.`}
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!!busy}
          onClick={() => fire("snooze")}
        >
          {busy === "snooze" ? "…" : "Snooze 7d"}
        </Button>
        <Button
          size="sm"
          variant="default"
          disabled={!!busy}
          onClick={() => fire("bump")}
        >
          {busy === "bump" ? "…" : "Bump now"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!!busy}
          onClick={() => fire("cancel")}
        >
          {busy === "cancel" ? "…" : "Cancel reminders"}
        </Button>
      </div>
      {msg && <div className="text-xs text-amber-300">{msg}</div>}
    </div>
  );
}

function ViewingReadinessPanel({ lead }) {
  const r = evaluateReadiness(lead);
  return (
    <div
      className={`rounded-md border p-3 ${
        r.ready ? "bg-emerald-500/10 border-emerald-500/25" : "bg-amber-500/10 border-amber-500/25"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">
          {r.ready
            ? `Viewing-ready${r.viewingMode === "virtual" ? " (virtual)" : ""}`
            : "Viewing not yet ready"}
        </div>
        <div className="text-xs text-foreground-variant">
          {r.met}/{r.total}
        </div>
      </div>
      <ul className="space-y-1">
        {REQUIREMENTS.map((req) => {
          const done = r.checks[req.key];
          return (
            <li key={req.key} className="flex items-center gap-2 text-xs">
              <span
                className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                  done
                    ? "bg-emerald-500 text-white"
                    : "bg-white/10 text-foreground-variant"
                }`}
              >
                {done ? "✓" : ""}
              </span>
              <span className={done ? "text-foreground" : "text-foreground-variant"}>
                {req.label}
              </span>
            </li>
          );
        })}
      </ul>
      {!r.ready && (
        <div className="text-[11px] text-amber-300 mt-2 leading-snug">
          Viewing cannot proceed until all 5 are checked. Two roles need to be
          covered: <strong>door-opener</strong> (lets the prospect in) and
          <strong> shower</strong> (gives the tour), the same resident or
          captain can do both. If neither is available, last resort is a
          <strong> virtual viewing</strong>: Mark shares the door code remotely
          and conducts the tour over video.
        </div>
      )}
    </div>
  );
}
