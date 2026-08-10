import { useEffect, useMemo, useState } from "react";
import PortalLayout from "../../components/portal/PortalLayout";
import PageHeader from "../../components/portal/PageHeader";
import { supabase } from "../../lib/supabase";
import {
  BILLING,
  billingOf,
  priceBreakdown,
} from "../../../supabase/functions/_shared/channelPricing.js";

/**
 * Channel pricing rules.
 *
 * The point of this screen is that a price rule you cannot read is a price rule
 * you cannot switch off. Every uplift the booking site and the agents see is
 * derived from these rows, so this is where you check what a channel is really
 * costing before you find out from a reconciliation three months later.
 *
 * The preview at the bottom is deliberate. The arithmetic (a gross-up divides
 * rather than multiplies, so an agent's month is a month of the QUOTED rent)
 * is not obvious from the numbers in the table, and the fastest way to trust it
 * is to pick a real room and read the quote back.
 */

const LEASE_OPTIONS = [3, 6, 12, 24];
const money = (n) => `$${Number(n).toLocaleString("en-SG", { maximumFractionDigits: 0 })}`;

/** How a channel bills us, in words, for the table. */
function billingLabel(ch) {
  try {
    switch (billingOf(ch)) {
      case BILLING.MONTHS: {
        const m = Number(ch.commission_months);
        return `${m} month${m === 1 ? "" : "s"} rent`;
      }
      case BILLING.PERCENT:
        return `${(Number(ch.commission_pct) * 100).toFixed(1)}% of rent`;
      default:
        return ch.fee_fixed ? `${money(ch.fee_fixed)} flat` : "no cost";
    }
  } catch (err) {
    // A row with both commission fields set. Surface it rather than render a
    // number that would be wrong in a way nobody could see.
    return `misconfigured: ${err.message}`;
  }
}

export default function AdminChannelPricingPage() {
  const [channels, setChannels] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [leaseMonths, setLeaseMonths] = useState(12);
  const [roomId, setRoomId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    Promise.all([
      supabase.from("listing_channels").select("*").order("slug"),
      supabase
        .from("rooms")
        .select("id, unit_code, price_monthly")
        .not("price_monthly", "is", null)
        .order("unit_code"),
    ]).then(([chRes, roomRes]) => {
      if (!live) return;
      if (chRes.error) setError(chRes.error.message);
      setChannels(chRes.data ?? []);
      setRooms(roomRes.data ?? []);
      setRoomId(roomRes.data?.[0]?.id ?? "");
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, []);

  const room = rooms.find((r) => r.id === roomId) ?? null;

  /* The reference room for the table is whichever room is selected below, so
     the table and the preview always agree. Falls back to the median price so
     the columns are never empty on first load. */
  const referenceBase = useMemo(() => {
    if (room?.price_monthly) return Number(room.price_monthly);
    if (!rooms.length) return 1500;
    const sorted = rooms.map((r) => Number(r.price_monthly)).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }, [room, rooms]);

  async function patchChannel(ch, patch) {
    setSaving(ch.slug);
    setError(null);
    const { error: err } = await supabase
      .from("listing_channels")
      .update(patch)
      .eq("id", ch.id);
    // The CHECK constraints do the real validating. Surfacing the database's
    // own message beats reimplementing the rules here and letting them drift.
    if (err) setError(err.message);
    else setChannels((cs) => cs.map((c) => (c.id === ch.id ? { ...c, ...patch } : c)));
    setSaving(null);
  }

  const toggleEnabled = (ch) => patchChannel(ch, { enabled: !ch.enabled });

  /**
   * Edit the modifier in place. A channel bills in months or in percent, never
   * both, so setting one clears the other rather than leaving a stale value the
   * CHECK would then reject with a message about a field you did not touch.
   */
  function setModifier(ch, kind, raw) {
    const v = raw === "" ? null : Number(raw);
    if (v != null && (!Number.isFinite(v) || v < 0)) return;
    patchChannel(
      ch,
      kind === "months"
        ? { commission_months: v, commission_pct: null }
        : { commission_pct: v == null ? null : v / 100, commission_months: null },
    );
  }

  const rows = channels.map((ch) => {
    let b = null;
    let rowError = null;
    try {
      b = priceBreakdown(referenceBase, ch, leaseMonths);
    } catch (err) {
      rowError = err.message;
    }
    return { ch, b, rowError };
  });

  return (
    <PortalLayout>
      <div className="space-y-4">
        <PageHeader
          eyebrow="Admin"
          title="Channel pricing"
          action={
            <select
              value={leaseMonths}
              onChange={(e) => setLeaseMonths(Number(e.target.value))}
              className="bg-surface-container border border-border rounded px-3 py-2 text-sm text-foreground"
            >
              {LEASE_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m} month lease
                </option>
              ))}
            </select>
          }
        />

        <p className="text-sm text-foreground-variant max-w-2xl">
          One base price per room, in <code>rooms.price_monthly</code>. Every channel adds its
          cost on top, and the quote is worked out when it is read, so changing a base price
          moves every channel at once. Figures below are for{" "}
          <strong className="text-foreground">
            {room ? `${room.unit_code} at ${money(referenceBase)}` : money(referenceBase)}
          </strong>{" "}
          on a {leaseMonths} month lease.
        </p>

        {error && (
          <div className="border border-red-500 bg-red-500/10 text-foreground px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-foreground-variant">Loading channels…</p>
        ) : (
          <div className="overflow-x-auto border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-container text-foreground-variant">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Channel</th>
                  <th className="text-left font-medium px-4 py-3">They take</th>
                  <th className="text-right font-medium px-4 py-3">Quoted / mo</th>
                  <th className="text-right font-medium px-4 py-3">Their cut</th>
                  <th className="text-right font-medium px-4 py-3">We net</th>
                  <th className="text-right font-medium px-4 py-3">Live</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ ch, b, rowError }) => (
                  <tr key={ch.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="text-foreground">{ch.name}</div>
                      <div className="text-xs text-foreground-variant">{ch.slug}</div>
                    </td>
                    <td className="px-4 py-3">
                      {/* Editable in place: the whole point of this screen is
                          trying a number and seeing what it does to the net. */}
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          defaultValue={ch.commission_months ?? ""}
                          onBlur={(e) => {
                            const next = e.target.value === "" ? null : Number(e.target.value);
                            if (next !== (ch.commission_months ?? null)) {
                              setModifier(ch, "months", e.target.value);
                            }
                          }}
                          className="w-16 bg-surface-container border border-border px-2 py-1 text-sm text-foreground"
                          aria-label={`${ch.name} commission in months`}
                        />
                        <span className="text-xs text-foreground-variant">mo</span>
                        <span className="text-xs text-foreground-variant">or</span>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="99"
                          defaultValue={ch.commission_pct != null ? ch.commission_pct * 100 : ""}
                          onBlur={(e) => {
                            const next = e.target.value === "" ? null : Number(e.target.value) / 100;
                            if (next !== (ch.commission_pct ?? null)) {
                              setModifier(ch, "pct", e.target.value);
                            }
                          }}
                          className="w-16 bg-surface-container border border-border px-2 py-1 text-sm text-foreground"
                          aria-label={`${ch.name} commission percent`}
                        />
                        <span className="text-xs text-foreground-variant">%</span>
                        <label className="flex items-center gap-1 text-xs text-foreground-variant ml-1">
                          <input
                            type="checkbox"
                            checked={ch.gross_up !== false}
                            onChange={() => patchChannel(ch, { gross_up: !(ch.gross_up !== false) })}
                          />
                          on top
                        </label>
                      </div>
                      <div className="text-xs text-foreground-variant mt-1">
                        {billingLabel(ch)}
                        {ch.gross_up === false && billingOf(ch) !== BILLING.NONE && (
                          <span className="ml-2 text-amber-400">absorbed by us</span>
                        )}
                      </div>
                    </td>
                    {rowError ? (
                      <td colSpan={3} className="px-4 py-3 text-red-400 text-xs">
                        {rowError}
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-right font-mono text-foreground">
                          {money(b.quotedMonthly)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-foreground-variant">
                          {b.channelCost ? money(b.channelCost) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-foreground">
                          {money(b.netMonthly)}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => toggleEnabled(ch)}
                        disabled={saving === ch.slug}
                        className={`text-xs px-3 py-1 border transition-colors ${
                          ch.enabled
                            ? "border-emerald-500 text-emerald-400"
                            : "border-border text-foreground-variant"
                        }`}
                      >
                        {saving === ch.slug ? "…" : ch.enabled ? "on" : "off"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <ChannelPins channels={channels} onError={setError} />

        <div className="border border-border p-4 space-y-3">
          <h2 className="text-foreground font-medium">Preview a quote</h2>
          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="bg-surface-container border border-border rounded px-3 py-2 text-sm text-foreground"
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.unit_code} · {money(r.price_monthly)} base
                </option>
              ))}
            </select>
            <span className="text-sm text-foreground-variant">
              on a {leaseMonths} month lease
            </span>
          </div>
          {room && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {rows
                .filter(({ ch }) => ch.enabled)
                .map(({ ch, b, rowError }) => (
                  <div key={ch.id} className="border border-border p-3">
                    <div className="text-xs text-foreground-variant">{ch.name}</div>
                    {rowError ? (
                      <div className="text-xs text-red-400 mt-1">{rowError}</div>
                    ) : (
                      <>
                        <div className="text-xl font-mono text-foreground">
                          {money(b.quotedMonthly)}
                        </div>
                        <div className="text-xs text-foreground-variant">
                          {b.channelCost
                            ? `${ch.name} takes ${money(b.channelCost)} · we net ${money(b.net)}`
                            : `we net ${money(b.net)}`}
                        </div>
                      </>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}

/**
 * PINs for the human channels.
 *
 * An agent is a channel we reach through a person rather than a browser worker,
 * so they do not get a login, they get a code. One row per person even when
 * several sit on the same channel, because that is what makes usage
 * attributable and lets you revoke one without touching the others.
 */
function ChannelPins({ channels, onError }) {
  const [pins, setPins] = useState([]);
  const [label, setLabel] = useState("");
  const [channelId, setChannelId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase
      .from("channel_pins")
      .select("pin, label, enabled, last_used_at, use_count, channel_id")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) onError?.(error.message);
        else setPins(data ?? []);
      });
  }, [onError]);

  useEffect(() => {
    if (!channelId && channels.length) setChannelId(channels[0].id);
  }, [channels, channelId]);

  async function issue() {
    if (!label.trim() || !channelId) return;
    setBusy(true);
    // Six digits, generated here so it can be read out over the phone. Retried
    // on collision rather than made longer: the primary key is the guard.
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    const { error } = await supabase
      .from("channel_pins")
      .insert({ pin, channel_id: channelId, label: label.trim() });
    if (error) onError?.(error.message);
    else {
      setPins((p) => [{ pin, label: label.trim(), enabled: true, use_count: 0, channel_id: channelId }, ...p]);
      setLabel("");
    }
    setBusy(false);
  }

  async function revoke(pin) {
    const { error } = await supabase
      .from("channel_pins")
      .update({ enabled: false })
      .eq("pin", pin);
    if (error) onError?.(error.message);
    else setPins((p) => p.map((r) => (r.pin === pin ? { ...r, enabled: false } : r)));
  }

  const nameOf = (id) => channels.find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="border border-border p-4 space-y-3">
      <h2 className="text-foreground font-medium">Access PINs</h2>
      <p className="text-sm text-foreground-variant max-w-2xl">
        Hand one of these to an agent or a partner. They enter it on the booking site and
        every price becomes that channel&apos;s quote, with their commission alongside it. No
        account, no login. A PIN only ever unlocks prices, never tenant data.
      </p>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Who holds it, e.g. Serena, PropNex"
          className="bg-surface-container border border-border px-3 py-2 text-sm text-foreground flex-1 min-w-64"
        />
        <select
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
          className="bg-surface-container border border-border px-3 py-2 text-sm text-foreground"
        >
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          onClick={issue}
          disabled={busy || !label.trim()}
          className="bg-accent text-accent-foreground px-4 py-2 text-sm disabled:opacity-50"
        >
          {busy ? "…" : "Issue PIN"}
        </button>
      </div>

      {pins.length > 0 && (
        <table className="w-full text-sm">
          <thead className="text-foreground-variant">
            <tr>
              <th className="text-left font-medium py-2">PIN</th>
              <th className="text-left font-medium py-2">Holder</th>
              <th className="text-left font-medium py-2">Channel</th>
              <th className="text-right font-medium py-2">Used</th>
              <th className="text-right font-medium py-2"></th>
            </tr>
          </thead>
          <tbody>
            {pins.map((p) => (
              <tr key={p.pin} className="border-t border-border">
                <td className="py-2 font-mono text-foreground">{p.pin}</td>
                <td className="py-2 text-foreground-variant">{p.label}</td>
                <td className="py-2 text-foreground-variant">{nameOf(p.channel_id)}</td>
                <td className="py-2 text-right font-mono text-foreground-variant">
                  {p.use_count ?? 0}
                </td>
                <td className="py-2 text-right">
                  {p.enabled ? (
                    <button onClick={() => revoke(p.pin)} className="text-xs text-red-400">
                      revoke
                    </button>
                  ) : (
                    <span className="text-xs text-foreground-variant">revoked</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
