// The staff room desk at /staff.
//
// Replaces StaffResourcePage.jsx. The data layer is carried across unchanged on
// purpose: the same two queries, the same tables, and above all the same read of
// rooms.next_available. That column is derived server side by
// fn_recompute_room_availability and the guest booking site reads it too, so
// recomputing availability here would make lazybee.sg and book.lazybee.sg quote
// different dates for the same room. Read it, never derive it.

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import SEO from '../../components/SEO';
import ThemeToggle from '../../components/ThemeToggle';
import { BeeMark } from '../../components/owners/OwnerChrome';
import { LazybeeRoot } from '../../hooks/useLazybeeTheme';
import RoomSearch from '../../components/staff/RoomSearch';
import RoomCard from '../../components/staff/RoomCard';
import PropertyPanel from '../../components/staff/PropertyPanel';
import StaffReference from '../../components/staff/StaffReference';
import {
  EMPTY_SEARCH,
  isSearchActive,
  isLettable,
  roomMatchesSearch,
} from '../../lib/staffRooms';
import '../../styles/lazybee.css';

const PROPERTY_ORDER = ['CP', 'IH', 'TG'];

export default function StaffRoomDeskPage() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState(EMPTY_SEARCH);
  const [current, setCurrent] = useState(PROPERTY_ORDER[0]);

  useEffect(() => {
    async function fetchData() {
      const [propRes, tenantRes] = await Promise.all([
        supabase.from('properties').select('*, rooms(*)').order('name'),
        supabase
          .from('tenant_profiles')
          .select(
            'room_id, username, gender, is_active, monthly_rent, moved_in_at, lease_end, tenant_details(full_name, nationality)',
          )
          .eq('is_active', true),
      ]);

      if (propRes.error) {
        setError(propRes.error.message);
        setLoading(false);
        return;
      }

      // tenantRes failing is not an error worth showing. Signed out, RLS rejects
      // the read, and the housemates block explains itself rather than the whole
      // page refusing to render over a roster nobody is entitled to see.
      const byRoom = {};
      (tenantRes.data || []).forEach((t) => {
        (byRoom[t.room_id] ||= []).push(t);
      });

      const sorted = PROPERTY_ORDER
        .map((code) => propRes.data.find((p) => p.code === code))
        .filter(Boolean);
      sorted.forEach((p) => {
        (p.rooms || []).sort((a, b) => a.unit_code.localeCompare(b.unit_code));
        (p.rooms || []).forEach((r) => {
          r.tenant_profiles = byRoom[r.id] || [];
        });
      });

      setProperties(sorted);
      setLoading(false);
    }
    fetchData();
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const active = isSearchActive(search);
  const hits = active
    ? properties
        .flatMap((p) => (p.rooms || []).filter(isLettable).map((room) => ({ room, property: p })))
        .filter(({ room, property }) => roomMatchesSearch(room, property.code, search, today))
        .sort((a, b) => (a.room.price_monthly || 0) - (b.room.price_monthly || 0))
    : [];
  const homeCount = new Set(hits.map(({ property }) => property.code)).size;
  const shown = properties.find((p) => p.code === current);

  return (
    <LazybeeRoot>
      <SEO title="Staff Resources" noindex />

      <div className="topbar">
        <span className="brandlock">
          <BeeMark />
          <span className="wd">LAZYBEE</span>
        </span>
        <nav className="navlinks">
          <span className="label" style={{ letterSpacing: '.16em' }}>Staff</span>
          <ThemeToggle />
        </nav>
      </div>

      <main className="wrap-wide" style={{ paddingBottom: 'var(--s9)' }}>
        <section className="sec-sm">
          <RoomSearch
            search={search}
            onChange={setSearch}
            onClear={() => setSearch(EMPTY_SEARCH)}
            active={active}
            count={hits.length}
            homeCount={homeCount}
          />
        </section>

        {loading && <div className="skeleton" style={{ height: 320 }} />}
        {error && <div className="note note-bad">Could not load rooms: {error}</div>}

        {!loading && !error &&
          (active ? (
            hits.length > 0 ? (
              <div className="rooms">
                {hits.map(({ room, property }) => (
                  <RoomCard key={room.id} room={room} property={property} today={today} />
                ))}
              </div>
            ) : (
              <div className="empty">
                <div className="h3">Nothing matches</div>
                <p className="small" style={{ maxWidth: '46ch', margin: '0 auto' }}>
                  Widen the budget, or switch the date to flexible to include rooms freeing
                  within thirty days of it.
                </p>
              </div>
            )
          ) : (
            <section>
              <div className="tabs">
                {properties.map((p) => (
                  <button
                    key={p.code}
                    type="button"
                    className={`chip${p.code === current ? ' on' : ''}`}
                    aria-pressed={p.code === current}
                    onClick={() => setCurrent(p.code)}
                  >
                    {p.code}, {p.name}
                  </button>
                ))}
              </div>
              {shown && <PropertyPanel property={shown} today={today} />}
            </section>
          ))}

        <StaffReference />
      </main>
    </LazybeeRoot>
  );
}
