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

  async function toggleEnabled(ch) {
    setSaving(ch.slug);
    const { error: err } = await supabase
      .from("listing_channels")
      .update({ enabled: !ch.enabled })
      .eq("id", ch.id);
    if (err) setError(err.message);
    else setChannels((cs) => cs.map((c) => (c.id === ch.id ? { ...c, enabled: !c.enabled } : c)));
    setSaving(null);
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
                    <td className="px-4 py-3 text-foreground-variant">
                      {billingLabel(ch)}
                      {ch.gross_up === false && billingOf(ch) !== BILLING.NONE && (
                        <span className="ml-2 text-xs text-amber-400">absorbed</span>
                      )}
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
