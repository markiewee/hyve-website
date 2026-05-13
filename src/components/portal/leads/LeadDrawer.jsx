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

export function LeadDrawer({ lead, open, onOpenChange, onSave }) {
  const [draft, setDraft] = useState(lead || {});
  const [intentText, setIntentText] = useState("{}");
  const [intentError, setIntentError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (lead) {
      setDraft(lead);
      setIntentText(JSON.stringify(lead.intent || {}, null, 2));
      setIntentError(null);
    }
  }, [lead]);

  if (!lead) return null;

  const beeperLink = `/open/${encodeURIComponent(lead.chat_id || "")}`;

  function handleIntentChange(e) {
    const value = e.target.value;
    setIntentText(value);
    try {
      const parsed = JSON.parse(value);
      setDraft((d) => ({ ...d, intent: parsed }));
      setIntentError(null);
    } catch (err) {
      setIntentError(err.message);
    }
  }

  async function handleSave() {
    if (intentError) return;
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

          <div>
            <label className="text-xs text-slate-500 block mb-1">Intent (JSON)</label>
            <Textarea
              rows={8}
              className="font-mono text-xs"
              value={intentText}
              onChange={handleIntentChange}
            />
            {intentError && (
              <div className="text-xs text-red-600 mt-1">Invalid JSON: {intentError}</div>
            )}
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
            <Button onClick={handleSave} disabled={!!intentError || saving}>
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
