import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import { buildPayload, listPriceFor, mergeProfiles, fieldOrigin } from "../../lib/listingCanonical";

const MECHANISMS = [
  { value: "browser", label: "Computer use" },
  { value: "api", label: "API" },
  { value: "feed", label: "Feed" },
];

/**
 * Listings, in two halves.
 *
 * Platforms: set each one up once. Commission, how we talk to it, whether it
 * is live, and a test you can actually fire.
 *
 * Content: nested building then room. Building holds what is true for everyone
 * at that address; room holds what is specific. Editing the building once
 * reaches every room under it, which is the whole point: the alternative is
 * typing the same address and house rules nineteen times and watching them
 * drift apart.
 */
export default function AdminListingsPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "content" ? "content" : "platforms";
  const setTab = (t) => {
    const p = new URLSearchParams(params);
    t === "platforms" ? p.delete("tab") : p.set("tab", t);
    setParams(p, { replace: true });
  };

  const [channels, setChannels] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: chans, error: cErr }, { data: props, error: pErr }] = await Promise.all([
      supabase.from("listing_channels").select("*").order("name"),
      supabase
        .from("properties")
        .select(
          "id, name, code, rooms(id, unit_code, name, room_type, price_monthly, next_available, min_stay_months)"
        )
        .order("code"),
    ]);
    if (cErr || pErr) {
      setError((cErr || pErr).message);
      setLoading(false);
      return;
    }

    const { data: profiles, error: prErr } = await supabase
      .from("listing_profiles")
      .select("id, scope, room_id, property_id, title, description, hero_photo, photos, fields, needs_review");
    if (prErr) {
      setError(prErr.message);
      setLoading(false);
      return;
    }

    const byRoom = new Map(profiles.filter((p) => p.room_id).map((p) => [p.room_id, p]));
    const byProp = new Map(profiles.filter((p) => p.property_id).map((p) => [p.property_id, p]));

    setChannels(chans ?? []);
    setProperties(
      (props ?? []).map((p) => ({
        ...p,
        profile: byProp.get(p.id) ?? null,
        rooms: (p.rooms ?? [])
          .filter((r) => r.room_type)
          .sort((a, b) => a.unit_code.localeCompare(b.unit_code))
          .map((r) => ({ ...r, profile: byRoom.get(r.id) ?? null })),
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <PortalLayout>
        <div className="h-64 bg-white/5 animate-pulse rounded-2xl" />
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="mb-6">
        <span className="block text-[11px] uppercase tracking-[0.4em] font-semibold text-accent mb-4">
          Growth
        </span>
        <h1 className="font-display text-3xl font-extrabold text-foreground tracking-tight">
          Listings
        </h1>
        <p className="text-foreground-variant font-['Inter'] font-medium mt-1">
          Set the platforms up once. Edit the content once. Everything else is replication.
        </p>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-500/25 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-2 mb-6">
        {[
          ["platforms", "Platforms"],
          ["content", "Content"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-colors ${
              tab === key
                ? "bg-accent text-white"
                : "bg-surface text-foreground-variant border border-border hover:bg-white/5"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "platforms" ? (
        <PlatformsTab channels={channels} setChannels={setChannels} onError={setError} />
      ) : (
        <ContentTab
          properties={properties}
          channels={channels}
          reload={load}
          onError={setError}
        />
      )}
    </PortalLayout>
  );
}

/* ───────────────────────────── Platforms ───────────────────────────── */

function PlatformsTab({ channels, setChannels, onError }) {
  const [testing, setTesting] = useState(null);

  async function patch(id, p) {
    onError(null);
    const { error } = await supabase.from("listing_channels").update(p).eq("id", id);
    if (error) return onError(error.message);
    setChannels((cs) => cs.map((c) => (c.id === id ? { ...c, ...p } : c)));
  }

  async function test(channel) {
    setTesting(channel.id);
    onError(null);
    try {
      const { data, error } = await supabase.functions.invoke("test-channel", {
        body: { channel_id: channel.id },
      });
      if (error) throw error;
      setChannels((cs) =>
        cs.map((c) =>
          c.id === channel.id
            ? {
                ...c,
                test_status: data.status,
                test_kind: data.kind,
                test_result: data.result,
                last_tested_at: new Date().toISOString(),
              }
            : c
        )
      );
    } catch (e) {
      onError(`Test failed to run: ${e.message}`);
    } finally {
      setTesting(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground-variant">
        A test currently proves <strong>reachability only</strong>: the platform answered us. It
        does not prove we are logged in, and it cannot prove a listing landed correctly until the
        mapper and read-back exist. The result says which of those was actually checked.
      </p>

      {channels.map((c) => (
        <div key={c.id} className="bg-surface rounded-2xl border border-border p-5">
          <div className="flex flex-wrap items-center gap-4 justify-between">
            <div className="min-w-[160px]">
              <p className="font-bold text-foreground">{c.name}</p>
              <p className="text-xs text-foreground-variant">
                {c.config?.region ?? "region unknown"}
              </p>
            </div>

            <label className="text-xs text-foreground-variant flex items-center gap-2">
              link
              <select
                value={c.mechanism}
                onChange={(e) => patch(c.id, { mechanism: e.target.value })}
                className="bg-surface-container border border-border rounded px-2 py-1 text-foreground text-sm"
              >
                {MECHANISMS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs text-foreground-variant flex items-center gap-2">
              commission
              <input
                type="number"
                step="0.5"
                min="0"
                max="99"
                defaultValue={c.commission_pct ?? ""}
                onBlur={(e) =>
                  patch(c.id, {
                    commission_pct: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className="w-20 bg-surface-container border border-border rounded px-2 py-1 text-foreground text-sm"
                placeholder="?"
              />
              %
            </label>

            <label className="text-xs text-foreground-variant flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={c.enabled}
                onChange={(e) => patch(c.id, { enabled: e.target.checked })}
              />
              enabled
            </label>

            <button
              onClick={() => test(c)}
              disabled={testing === c.id}
              className="px-4 py-2 rounded-lg bg-surface-container text-foreground text-sm font-bold border border-border hover:bg-white/5 disabled:opacity-50"
            >
              {testing === c.id ? "Testing..." : "Test linkage"}
            </button>
          </div>

          {c.test_status && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`px-2 py-1 rounded-full font-bold ${
                  c.test_status === "PASS"
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-red-500/15 text-red-300"
                }`}
              >
                {c.test_status} · {c.test_kind?.toLowerCase().replace("_", " ")}
              </span>
              <span className="text-foreground-variant">
                {c.test_result?.http_status ? `HTTP ${c.test_result.http_status}` : ""}
                {c.test_result?.ms ? ` · ${c.test_result.ms}ms` : ""}
                {c.test_result?.error ? ` · ${c.test_result.error}` : ""}
                {c.test_result?.note ? ` · ${c.test_result.note}` : ""}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────────── Content ───────────────────────────── */

function ContentTab({ properties, channels, reload, onError }) {
  const [openProp, setOpenProp] = useState(properties[0]?.id ?? null);
  const [sel, setSel] = useState(
    properties[0] ? { level: "property", id: properties[0].id } : null
  );

  const target = useMemo(() => {
    if (!sel) return null;
    if (sel.level === "property") {
      const p = properties.find((x) => x.id === sel.id);
      return p ? { level: "property", entity: p, profile: p.profile, parent: null } : null;
    }
    for (const p of properties) {
      const r = p.rooms.find((x) => x.id === sel.id);
      if (r) return { level: "room", entity: r, profile: r.profile, parent: p };
    }
    return null;
  }, [sel, properties]);

  return (
    <div className="grid lg:grid-cols-[300px_1fr] gap-6">
      <div className="space-y-2">
        {properties.map((p) => (
          <div key={p.id} className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="flex">
              <button
                onClick={() => setSel({ level: "property", id: p.id })}
                className={`flex-1 text-left px-4 py-3 ${
                  sel?.level === "property" && sel.id === p.id
                    ? "bg-accent text-white"
                    : "text-foreground hover:bg-white/5"
                }`}
              >
                <span className="font-bold text-sm">{p.name}</span>
                <span className="block text-xs opacity-70">
                  building level · {p.rooms.length} rooms
                </span>
              </button>
              <button
                onClick={() => setOpenProp((o) => (o === p.id ? null : p.id))}
                className="px-3 text-foreground-variant hover:text-foreground"
                aria-label="toggle rooms"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {openProp === p.id ? "expand_less" : "expand_more"}
                </span>
              </button>
            </div>

            {openProp === p.id && (
              <div className="border-t border-border">
                {p.rooms.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSel({ level: "room", id: r.id })}
                    className={`w-full text-left pl-8 pr-4 py-2 text-sm border-b border-border last:border-b-0 ${
                      sel?.level === "room" && sel.id === r.id
                        ? "bg-accent text-white"
                        : "text-foreground hover:bg-white/5"
                    }`}
                  >
                    {r.unit_code}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {target ? (
        <ProfileEditor
          key={`${target.level}:${target.entity.id}`}
          target={target}
          channels={channels}
          reload={reload}
          onError={onError}
        />
      ) : (
        <div className="bg-surface rounded-2xl border border-border p-10 text-center text-foreground-variant">
          Pick a building or a room.
        </div>
      )}
    </div>
  );
}

function ProfileEditor({ target, channels, reload, onError }) {
  const { level, entity, profile, parent } = target;
  const [draft, setDraft] = useState({
    title: profile?.title ?? "",
    description: profile?.description ?? "",
    hero_photo: profile?.hero_photo ?? "",
    needs_review: profile?.needs_review ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const parentProfile = parent?.profile ?? null;

  // What this room would actually send, once the building is merged in.
  const effective = useMemo(
    () => (level === "room" ? mergeProfiles(parentProfile, { ...profile, ...nulled(draft) }) : null),
    [level, parentProfile, profile, draft]
  );

  const readiness = useMemo(() => {
    if (level !== "room" || !effective) return null;
    let ok = 0;
    const reasons = new Set();
    for (const c of channels) {
      const res = buildPayload({
        room: entity,
        profile: effective,
        channel: { ...c, config: c.config ?? {} },
      });
      if (res.publishable) ok++;
      else res.blockers.forEach((b) => reasons.add(b));
    }
    return { ok, total: channels.length, reasons: [...reasons] };
  }, [level, effective, channels, entity]);

  async function save() {
    if (!profile) return onError("No listing profile exists for this yet.");
    setSaving(true);
    onError(null);
    try {
      const { error } = await supabase
        .from("listing_profiles")
        .update({
          title: blankToNull(draft.title),
          description: blankToNull(draft.description),
          hero_photo: blankToNull(draft.hero_photo),
          needs_review: draft.needs_review,
        })
        .eq("id", profile.id);
      if (error) throw error;
      setSaved(true);
      await reload();
    } catch (e) {
      onError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const inherited = (key) =>
    level === "room" && fieldOrigin(parentProfile, nulled(draft), key) === "property";

  return (
    <div className="space-y-6">
      <div className="bg-surface rounded-2xl border border-border p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <h2 className="font-display text-xl font-extrabold text-foreground">
              {level === "property" ? entity.name : entity.unit_code}
            </h2>
            <p className="text-sm text-foreground-variant">
              {level === "property"
                ? `Building level. Applies to all ${entity.rooms.length} rooms unless a room overrides it.`
                : `${parent?.name} · net SGD ${Number(entity.price_monthly).toFixed(2)}/mo`}
            </p>
          </div>
          {readiness && (
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                readiness.ok > 0
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-amber-500/15 text-amber-300"
              }`}
            >
              publishable to {readiness.ok} of {readiness.total}
            </span>
          )}
        </div>

        <Field
          label="Title"
          hint={
            level === "property"
              ? "Shown as the building's name wherever a platform asks for one."
              : `Leave blank to inherit the building's. Internal name is "${entity.name}".`
          }
          inherited={inherited("title")}
          inheritedValue={parentProfile?.title}
        >
          <input
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            className="w-full bg-surface-container border border-border rounded-lg px-4 py-2.5 text-foreground text-sm"
          />
        </Field>

        <Field
          label="Description"
          hint={`${draft.description.length} characters. Longer platforms get it whole, shorter ones are cut on a sentence boundary.`}
          inherited={inherited("description")}
          inheritedValue={parentProfile?.description}
        >
          <textarea
            rows={5}
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            className="w-full bg-surface-container border border-border rounded-lg px-4 py-2.5 text-foreground text-sm"
          />
        </Field>

        <Field
          label="Hero photo"
          hint={`Sent first. ${(profile?.photos ?? []).length} photos on this level.`}
          inherited={inherited("hero_photo")}
          inheritedValue={parentProfile?.hero_photo}
        >
          <input
            value={draft.hero_photo}
            onChange={(e) => setDraft((d) => ({ ...d, hero_photo: e.target.value }))}
            className="w-full bg-surface-container border border-border rounded-lg px-4 py-2.5 text-foreground text-sm font-mono"
          />
        </Field>

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
              {level === "property"
                ? "An unreviewed building blocks every room under it."
                : "Both this room and its building must be approved before anything publishes."}
            </span>
          </span>
        </label>

        {readiness?.reasons.length > 0 && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/15 px-4 py-3 mb-5">
            <p className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-1">
              Blocking publication
            </p>
            <ul className="text-sm text-amber-300 list-disc pl-5 space-y-0.5">
              {readiness.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-bold hover:bg-accent/90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          {saved && <span className="text-sm text-emerald-300">Saved.</span>}
        </div>
      </div>

      {level === "room" && (
        <div className="bg-surface rounded-2xl border border-border p-6">
          <h3 className="font-display text-lg font-extrabold text-foreground mb-1">
            What each platform would receive
          </h3>
          <p className="text-sm text-foreground-variant mb-4">
            Grossed up so we still net SGD {Number(entity.price_monthly).toFixed(2)} after
            commission.
          </p>
          <div className="space-y-1.5">
            {channels.map((c) => {
              const listed = listPriceFor(entity.price_monthly, c);
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between border border-border rounded-lg px-4 py-2 text-sm"
                >
                  <span className="text-foreground">{c.name}</span>
                  <span className="tabular-nums text-foreground-variant">
                    {listed === null ? (
                      <span className="text-amber-300">commission not set</span>
                    ) : (
                      `SGD ${listed.toFixed(2)}`
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, inherited, inheritedValue, children }) {
  return (
    <label className="block mb-4">
      <span className="flex items-center gap-2 mb-2">
        <span className="text-[10px] uppercase tracking-widest text-foreground-variant font-bold">
          {label}
        </span>
        {inherited && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-container text-foreground-variant">
            inherited
          </span>
        )}
      </span>
      {children}
      <span className="block text-xs text-foreground-variant mt-1">
        {inherited && inheritedValue
          ? `Currently showing the building's: "${String(inheritedValue).slice(0, 80)}"`
          : hint}
      </span>
    </label>
  );
}

/** Blank input means "inherit", so it becomes null before merging. */
function nulled(draft) {
  return {
    title: blankToNull(draft.title),
    description: blankToNull(draft.description),
    hero_photo: blankToNull(draft.hero_photo),
    needs_review: draft.needs_review,
  };
}

function blankToNull(v) {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}
