import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import { buildPayload, listPriceFor } from "../../lib/listingCanonical";

/**
 * Edit a room's listing once, see exactly what every platform would receive.
 *
 * The point of this screen is that it is the ONLY place a listing is edited.
 * The alternative, which is where we are today, is logging into twelve
 * platforms by hand, which means it does not happen, which means we quote one
 * price on lazybee.sg and a different one everywhere else.
 *
 * It deliberately shows blockers rather than hiding them. A room that cannot
 * be published should say why on the same screen where you would fix it.
 */
export default function AdminListingsPage() {
  const [rooms, setRooms] = useState([]);
  const [channels, setChannels] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: roomData, error: rErr }, { data: chanData, error: cErr }] = await Promise.all([
      supabase
        .from("rooms")
        .select(
          "id, unit_code, name, room_type, price_monthly, next_available, available_until, min_stay_months, properties(name, code), listing_profiles(id, title, description, hero_photo, photos, fields, needs_review)"
        )
        .not("room_type", "is", null)
        .order("unit_code"),
      supabase.from("listing_channels").select("*").order("name"),
    ]);

    if (rErr || cErr) setError((rErr || cErr).message);
    else {
      const withProfile = (roomData ?? []).map((r) => ({
        ...r,
        profile: Array.isArray(r.listing_profiles) ? r.listing_profiles[0] : r.listing_profiles,
      }));
      setRooms(withProfile);
      setChannels(chanData ?? []);
      setSelectedId((id) => id ?? withProfile[0]?.id ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = useMemo(() => rooms.find((r) => r.id === selectedId), [rooms, selectedId]);

  // Reset the draft whenever the selected room changes, so an unsaved edit on
  // one room can never be written onto another.
  useEffect(() => {
    if (!selected?.profile) return setDraft(null);
    const p = selected.profile;
    setDraft({
      title: p.title ?? "",
      description: p.description ?? "",
      hero_photo: p.hero_photo ?? "",
      needs_review: p.needs_review,
    });
    setSaved(false);
  }, [selected]);

  /** How many channels this room could publish to right now, and why not. */
  const readiness = useCallback(
    (room, over = null) => {
      const profile = over ? { ...room.profile, ...over } : room.profile;
      let ok = 0;
      const reasons = new Set();
      for (const c of channels) {
        const res = buildPayload({ room, profile, channel: { ...c, config: c.config ?? {} } });
        if (res.publishable) ok++;
        else res.blockers.forEach((b) => reasons.add(b));
      }
      return { ok, total: channels.length, reasons: [...reasons] };
    },
    [channels]
  );

  async function saveProfile() {
    if (!selected?.profile || !draft) return;
    setSaving(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from("listing_profiles")
        .update({
          title: draft.title.trim() || null,
          description: draft.description.trim() || null,
          hero_photo: draft.hero_photo.trim() || null,
          needs_review: draft.needs_review,
        })
        .eq("id", selected.profile.id);
      if (err) throw err;
      setSaved(true);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateChannel(id, patch) {
    setError(null);
    const { error: err } = await supabase.from("listing_channels").update(patch).eq("id", id);
    if (err) return setError(err.message);
    setChannels((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  if (loading) {
    return (
      <PortalLayout>
        <div className="h-64 bg-white/5 animate-pulse rounded-2xl" />
      </PortalLayout>
    );
  }

  const live = selected ? readiness(selected, draft) : null;

  return (
    <PortalLayout>
      <div className="mb-8">
        <span className="block text-[11px] uppercase tracking-[0.4em] font-semibold text-accent mb-4">
          Growth
        </span>
        <h1 className="font-display text-3xl font-extrabold text-foreground tracking-tight">
          Listings
        </h1>
        <p className="text-foreground-variant font-['Inter'] font-medium mt-1">
          Edit once here. Every platform receives the same truth.
        </p>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-500/25 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        {/* Rooms */}
        <div className="space-y-1.5">
          {rooms.map((r) => {
            const s = readiness(r);
            const active = r.id === selectedId;
            return (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                  active
                    ? "bg-accent text-white border-accent"
                    : "bg-surface border-border text-foreground hover:bg-white/5"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sm">{r.unit_code}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      active
                        ? "bg-white/20"
                        : s.ok > 0
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    {s.ok}/{s.total}
                  </span>
                </div>
                <p className={`text-xs mt-0.5 ${active ? "text-white/70" : "text-foreground-variant"}`}>
                  {r.properties?.name}
                </p>
              </button>
            );
          })}
        </div>

        {/* Editor */}
        {selected && draft ? (
          <div className="space-y-6">
            <div className="bg-surface rounded-2xl border border-border p-6">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                <div>
                  <h2 className="font-display text-xl font-extrabold text-foreground">
                    {selected.unit_code}
                  </h2>
                  <p className="text-sm text-foreground-variant">
                    {selected.properties?.name} · net SGD{" "}
                    {Number(selected.price_monthly).toFixed(2)}/mo
                    {selected.next_available ? ` · free from ${selected.next_available}` : ""}
                  </p>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                    live.ok > 0
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-amber-500/15 text-amber-300"
                  }`}
                >
                  publishable to {live.ok} of {live.total}
                </span>
              </div>

              <label className="block mb-4">
                <span className="block text-[10px] uppercase tracking-widest text-foreground-variant font-bold mb-2">
                  Listing title
                </span>
                <input
                  value={draft.title}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  className="w-full bg-surface-container border border-border rounded-lg px-4 py-2.5 text-foreground text-sm"
                  placeholder="What a prospect sees first"
                />
                <span className="block text-xs text-foreground-variant mt-1">
                  Internal name is &ldquo;{selected.name}&rdquo;, which must never reach a platform.
                </span>
              </label>

              <label className="block mb-4">
                <span className="block text-[10px] uppercase tracking-widest text-foreground-variant font-bold mb-2">
                  Description
                </span>
                <textarea
                  rows={5}
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  className="w-full bg-surface-container border border-border rounded-lg px-4 py-2.5 text-foreground text-sm"
                />
                <span className="block text-xs text-foreground-variant mt-1">
                  {draft.description.length} characters. Platforms with shorter caps are truncated
                  on a sentence boundary, never mid-word.
                </span>
              </label>

              <label className="block mb-5">
                <span className="block text-[10px] uppercase tracking-widest text-foreground-variant font-bold mb-2">
                  Hero photo
                </span>
                <input
                  value={draft.hero_photo}
                  onChange={(e) => setDraft((d) => ({ ...d, hero_photo: e.target.value }))}
                  className="w-full bg-surface-container border border-border rounded-lg px-4 py-2.5 text-foreground text-sm font-mono"
                />
                <span className="block text-xs text-foreground-variant mt-1">
                  Sent first to every platform. {(selected.profile?.photos ?? []).length} photos on
                  file.
                </span>
              </label>

              <label className="flex items-start gap-3 mb-5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!draft.needs_review}
                  onChange={(e) => setDraft((d) => ({ ...d, needs_review: !e.target.checked }))}
                  className="mt-1"
                />
                <span className="text-sm text-foreground">
                  Reviewed and approved for publishing
                  <span className="block text-xs text-foreground-variant">
                    Titles were generated during backfill. Nothing publishes until this is ticked.
                  </span>
                </span>
              </label>

              {live.reasons.length > 0 && (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/15 px-4 py-3 mb-5">
                  <p className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-1">
                    Blocking publication
                  </p>
                  <ul className="text-sm text-amber-300 list-disc pl-5 space-y-0.5">
                    {live.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={saveProfile}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-bold hover:bg-accent/90 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                {saved && <span className="text-sm text-emerald-300">Saved.</span>}
              </div>
            </div>

            {/* What each channel would receive */}
            <div className="bg-surface rounded-2xl border border-border p-6">
              <h3 className="font-display text-lg font-extrabold text-foreground mb-1">
                What each platform would receive
              </h3>
              <p className="text-sm text-foreground-variant mb-5">
                List price is grossed up so that after commission we still net SGD{" "}
                {Number(selected.price_monthly).toFixed(2)}. A blank commission means unknown, and
                nothing publishes on an unknown.
              </p>

              <div className="space-y-2">
                {channels.map((c) => {
                  const listed = listPriceFor(selected.price_monthly, c);
                  return (
                    <div
                      key={c.id}
                      className="flex flex-wrap items-center gap-3 justify-between border border-border rounded-xl px-4 py-3"
                    >
                      <div className="min-w-[140px]">
                        <p className="font-bold text-sm text-foreground">{c.name}</p>
                        <p className="text-xs text-foreground-variant">
                          {c.mechanism}
                          {c.config?.region ? ` · ${c.config.region}` : ""}
                        </p>
                      </div>

                      <label className="flex items-center gap-2 text-xs text-foreground-variant">
                        commission
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="99"
                          defaultValue={c.commission_pct ?? ""}
                          onBlur={(e) =>
                            updateChannel(c.id, {
                              commission_pct: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          className="w-20 bg-surface-container border border-border rounded px-2 py-1 text-foreground text-sm"
                          placeholder="?"
                        />
                        %
                      </label>

                      <span className="text-sm tabular-nums text-foreground min-w-[110px]">
                        {listed === null ? (
                          <span className="text-amber-300">not priceable</span>
                        ) : (
                          `lists at ${listed.toFixed(2)}`
                        )}
                      </span>

                      <label className="flex items-center gap-2 text-xs text-foreground-variant cursor-pointer">
                        <input
                          type="checkbox"
                          checked={c.enabled}
                          onChange={(e) => updateChannel(c.id, { enabled: e.target.checked })}
                        />
                        enabled
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-surface rounded-2xl border border-border p-10 text-center text-foreground-variant">
            This room has no listing profile yet.
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
