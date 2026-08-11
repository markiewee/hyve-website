// The staff room desk at /staff.
//
// Replaces StaffResourcePage.jsx. Still two reads, and above all still the same
// read of rooms.next_available. That column is derived server side by
// fn_recompute_room_availability and the guest booking site reads it too, so
// recomputing availability here would make lazybee.sg and book.lazybee.sg quote
// different dates for the same room. Read it, never derive it.
//
// The second read changed in Aug 2026. The desk now has a channel partner in it
// on a dedicated PIN, so the roster comes from housemates_for_staff_pin, which
// returns nationality, gender and lease end and refuses to return names.

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import SEO from '../../components/SEO';
import ThemeToggle from '../../components/ThemeToggle';
import LangSwitch from '../../i18n/LangSwitch';
import { useLanguage } from '../../i18n/LanguageContext';
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
import { readPin, STORAGE_KEY } from '../../lib/staffPin';
import '../../styles/lazybee.css';

const PROPERTY_ORDER = ['CP', 'IH', 'TG'];

export default function StaffRoomDeskPage() {
  const { t } = useLanguage();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState(EMPTY_SEARCH);
  const [current, setCurrent] = useState(PROPERTY_ORDER[0]);

  useEffect(() => {
    async function fetchData() {
      // The roster used to be a direct select on tenant_profiles, whose only
      // policy is admin-only, so a PIN holder always saw an empty box. It now
      // goes through housemates_for_staff_pin, which returns nationality,
      // gender and lease end for a valid PIN and nothing else: no names, no
      // identity documents, no rent. A PIN that is unknown or has been disabled
      // gets an empty set rather than an error.
      let pin = null;
      try {
        pin = readPin(window.localStorage.getItem(STORAGE_KEY), Date.now());
      } catch {
        /* storage disabled. No roster, everything else still renders. */
      }

      const [propRes, mateRes] = await Promise.all([
        supabase.from('properties').select('*, rooms(*)').order('name'),
        pin
          ? supabase.rpc('housemates_for_staff_pin', { p_pin: pin })
          : Promise.resolve({ data: [] }),
      ]);

      if (propRes.error) {
        setError(propRes.error.message);
        setLoading(false);
        return;
      }

      // A failed roster read is not worth failing the page over. The rooms are
      // the point; the housemate block renders its own empty state.
      const byUnit = {};
      (mateRes.data || []).forEach((m) => {
        (byUnit[m.unit_code] ||= []).push(m);
      });

      const sorted = PROPERTY_ORDER
        .map((code) => propRes.data.find((p) => p.code === code))
        .filter(Boolean);
      sorted.forEach((p) => {
        (p.rooms || []).sort((a, b) => a.unit_code.localeCompare(b.unit_code));
        (p.rooms || []).forEach((r) => {
          r.housemates = byUnit[r.unit_code] || [];
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

      <div className="stafftop">
        <span className="brandlock">
          <BeeMark />
          <span className="wd">LAZYBEE</span>
        </span>
        <nav>
          <span className="label" style={{ letterSpacing: '.16em' }}>{t('staff.title')}</span>
          <ThemeToggle />
          <LangSwitch />
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
        {error && <div className="note note-bad">{t('staff.search.loadFail', { error })}</div>}

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
                <div className="h3">{t('staff.search.nothing')}</div>
                <p className="small" style={{ maxWidth: '46ch', margin: '0 auto' }}>
                  {t('staff.search.widen')}
                </p>
              </div>
            )
          ) : (
            <section>
              <div className="stafftabs">
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
