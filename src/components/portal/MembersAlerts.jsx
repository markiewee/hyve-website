import { differenceInDays, format } from "date-fns";

function classifyProperties(properties) {
  const leaseEnding30 = [];
  const leaseEnding60 = [];
  const oldOpenTickets = [];
  const vacant = [];

  const now = new Date();
  for (const p of properties) {
    for (const t of p.openTickets) {
      const age = differenceInDays(now, new Date(t.created_at));
      if (age > 7) oldOpenTickets.push({ propertyName: p.name, age, ticketId: t.id });
    }
    for (const r of p.rooms) {
      if (!r.tenant) {
        vacant.push({ propertyName: p.name, roomName: r.name, unit: r.unit_code });
        continue;
      }
      const end = r.tenant.lease_end ? new Date(r.tenant.lease_end) : null;
      if (end) {
        const days = differenceInDays(end, now);
        if (days <= 30 && days >= 0) {
          leaseEnding30.push({ propertyName: p.name, roomName: r.name, days, end });
        } else if (days <= 60 && days > 30) {
          leaseEnding60.push({ propertyName: p.name, roomName: r.name, days, end });
        }
      }
    }
  }
  return { leaseEnding30, leaseEnding60, oldOpenTickets, vacant };
}

function Section({ icon, title, items, render }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="font-medium mb-2">{icon} {title} <span className="text-xs text-gray-500">({items.length})</span></h3>
      <div className="space-y-2">{items.map(render)}</div>
    </div>
  );
}

export default function MembersAlerts({ properties, loading }) {
  if (loading) return <div className="text-sm text-gray-500">Loading…</div>;
  const groups = classifyProperties(properties);
  const total = groups.leaseEnding30.length + groups.leaseEnding60.length
    + groups.oldOpenTickets.length + groups.vacant.length;
  if (total === 0) {
    return <div className="text-center text-sm text-gray-500 py-12">All quiet 🐝</div>;
  }
  return (
    <div className="space-y-6">
      <Section
        icon="🟠" title="Lease ending in 30 days"
        items={groups.leaseEnding30}
        render={(it, i) => (
          <div key={i} className="rounded border p-3 text-sm">
            <span className="font-medium">{it.propertyName}</span> · {it.roomName} ·
            ends {format(it.end, "d MMM")} ({it.days} days)
          </div>
        )}
      />
      <Section
        icon="🟡" title="Lease ending 30–60 days"
        items={groups.leaseEnding60}
        render={(it, i) => (
          <div key={i} className="rounded border p-3 text-sm">
            <span className="font-medium">{it.propertyName}</span> · {it.roomName} ·
            ends {format(it.end, "d MMM")} ({it.days} days)
          </div>
        )}
      />
      <Section
        icon="🟡" title="Open tickets >7 days"
        items={groups.oldOpenTickets}
        render={(it, i) => (
          <div key={i} className="rounded border p-3 text-sm">
            <span className="font-medium">{it.propertyName}</span> · ticket open {it.age} days
          </div>
        )}
      />
      <Section
        icon="⚪" title="Vacant rooms"
        items={groups.vacant}
        render={(it, i) => (
          <div key={i} className="rounded border p-3 text-sm">
            <span className="font-medium">{it.propertyName}</span> · {it.roomName} ({it.unit})
          </div>
        )}
      />
    </div>
  );
}
