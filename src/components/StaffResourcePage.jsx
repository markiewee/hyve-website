import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './ui/accordion';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';
import SEO from './SEO';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const PROPERTY_ORDER = ['CP', 'IH', 'TG'];

const NAT_TO_FLAG = {
  'American': '🇺🇸', 'Singaporean': '🇸🇬', 'Indian': '🇮🇳', 'Indonesian': '🇮🇩',
  'Thai': '🇹🇭', 'Vietnamese': '🇻🇳', 'Lithuanian': '🇱🇹', 'Filipino': '🇵🇭',
  'Ukrainian': '🇺🇦', 'Malaysian': '🇲🇾', 'Chinese': '🇨🇳', 'Japanese': '🇯🇵',
  'Korean': '🇰🇷', 'British': '🇬🇧', 'Australian': '🇦🇺', 'French': '🇫🇷',
  'German': '🇩🇪', 'Myanmar': '🇲🇲', 'Bangladeshi': '🇧🇩', 'Sri Lankan': '🇱🇰',
  'Singapore PR': '🇸🇬', 'Singapore': '🇸🇬', 'PR': '🇸🇬',
};

function getFlag(nationality) {
  if (!nationality) return '';
  const key = nationality.trim();
  return NAT_TO_FLAG[key] || '';
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getAvailabilityStatus(room) {
  const now = new Date();
  if (!room.next_available) {
    if (room.available_until) {
      return { label: `Available now — until ${formatDate(room.available_until)}`, color: 'amber' };
    }
    return { label: 'Available now', color: 'green' };
  }
  const availDate = new Date(room.next_available);
  const daysUntil = Math.ceil((availDate - now) / (1000 * 60 * 60 * 24));
  if (daysUntil <= 30) {
    return { label: `Available from ${formatDate(room.next_available)}`, color: 'amber' };
  }
  return { label: `Available from ${formatDate(room.next_available)}`, color: 'red' };
}

const STATUS_COLORS = {
  green: 'bg-emerald-500/15 text-emerald-300',
  amber: 'bg-amber-500/15 text-amber-300',
  red: 'bg-red-500/15 text-red-300',
};

const BUDGET_BAND = 200; // show rooms ±$200 around the target budget

const LOCATIONS = [
  { code: 'ALL', label: 'All properties' },
  { code: 'CP', label: 'Chiltern Park · Serangoon' },
  { code: 'IH', label: 'Ivory Heights · Jurong East' },
  { code: 'TG', label: 'Thomson Grove · Lentor' },
];

const EMPTY_SEARCH = { date: '', dateMode: 'fixed', budget: '', location: 'ALL' };

// Real lettable bedrooms have a room_type + price; common areas, kitchens,
// yards and shared toilets have neither.
function isLettable(room) {
  return !!room.room_type && !!room.price_monthly;
}

function isSearchActive(s) {
  return !!(s.date || s.budget || (s.location && s.location !== 'ALL'));
}

// Does a room match the cross-property search? `today` is midnight-normalised.
function roomMatchesSearch(room, propertyCode, s, today) {
  // Budget: within ±BUDGET_BAND of the target
  if (s.budget) {
    const b = Number(s.budget);
    if (!room.price_monthly) return false;
    if (room.price_monthly < b - BUDGET_BAND || room.price_monthly > b + BUDGET_BAND) return false;
  }
  // Location
  if (s.location && s.location !== 'ALL' && propertyCode !== s.location) return false;
  // Move-in date — fixed = available by the date, flexible = within ~30 days after
  if (s.date) {
    const target = new Date(s.date); target.setHours(0, 0, 0, 0);
    const from = room.next_available ? new Date(room.next_available) : today;
    const limit = new Date(target);
    if (s.dateMode === 'flexible') limit.setDate(limit.getDate() + 30);
    if (from > limit) return false;
    // Available now but vacated before the target — exclude
    if (room.available_until && new Date(room.available_until) < target) return false;
  }
  return true;
}

function Detail({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between">
      <span className="text-foreground">{label}</span>
      <span className="text-foreground font-medium capitalize">{value}</span>
    </div>
  );
}

function computeRoomAvailability(room, tenants, today) {
  const real = tenants.filter(t => t.is_active && Number(t.monthly_rent) > 0);
  const current = real.filter(t =>
    new Date(t.moved_in_at) <= today &&
    (!t.lease_end || new Date(t.lease_end) >= today)
  );
  const future = real
    .filter(t => new Date(t.moved_in_at) > today)
    .sort((a, b) => new Date(a.moved_in_at) - new Date(b.moved_in_at));

  const maxOccupancy = room.max_occupancy || 1;
  const latestCurrentEnd = current
    .map(t => t.lease_end)
    .filter(Boolean)
    .sort()
    .pop();
  let next_available = null;
  let available_until = null;

  if (current.length > 0) {
    if (latestCurrentEnd) {
      const d = new Date(latestCurrentEnd);
      d.setDate(d.getDate() + 1);
      next_available = d.toISOString().slice(0, 10);
    }
  } else if (future.length > 0) {
    const firstFutureStart = new Date(future[0].moved_in_at);
    const gapDays = Math.round((firstFutureStart - today) / 86400000);
    const latestFutureEnd = future
      .map(t => t.lease_end)
      .filter(Boolean)
      .sort()
      .pop();
    if (gapDays <= 60 && latestFutureEnd) {
      const d = new Date(latestFutureEnd);
      d.setDate(d.getDate() + 1);
      next_available = d.toISOString().slice(0, 10);
    } else {
      const d = new Date(future[0].moved_in_at);
      d.setDate(d.getDate() - 1);
      available_until = d.toISOString().slice(0, 10);
    }
  }

  const upcoming_bookings = future.map(t => ({
    checkin: t.moved_in_at,
    checkout: t.lease_end,
    channel: 'Direct',
    overlap: current.length >= maxOccupancy && !!latestCurrentEnd &&
      new Date(t.moved_in_at) < new Date(latestCurrentEnd),
  }));

  return { next_available, available_until, upcoming_bookings };
}

function getPricingTiers(basePrice) {
  if (!basePrice) return null;
  const base = Number(basePrice);
  return [
    { label: '3 months', price: base + 100 },
    { label: '6 months', price: base + 50 },
    { label: '12 months', price: base, highlight: true },
    { label: '24 months', price: base - 50 },
  ];
}

function RoomCard({ room, property }) {
  const [expanded, setExpanded] = useState(false);
  const status = getAvailabilityStatus(room);
  const isAvailable = status.color === 'green' || status.color === 'amber' && !room.next_available;
  const roomTypeLabel = room.room_type
    ? room.room_type.charAt(0).toUpperCase() + room.room_type.slice(1)
    : '—';

  return (
    <div
      className="bg-surface rounded-xl border border-border overflow-hidden cursor-pointer hover:border-white/20 transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-foreground text-base">{room.unit_code}</h3>
              {property && (
                <span className="text-[10px] uppercase tracking-[0.15em] text-accent font-semibold">{property.name}</span>
              )}
            </div>
            <p className="text-sm text-foreground">{room.name}</p>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-foreground-variant transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
        <div className="flex items-center gap-3 text-sm mb-2 flex-wrap">
          {room.price_monthly && (
            <span className="font-semibold text-foreground">${room.price_monthly.toLocaleString()}/mo</span>
          )}
          {room.size_sqm && (
            <span className="text-foreground">{room.size_sqm} sqm</span>
          )}
          <span className="text-foreground">{roomTypeLabel}</span>
          {room.bed_size && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white/5 text-foreground-variant border border-white/10 capitalize">
              <span className="material-symbols-outlined text-[14px]">bed</span>
              {room.bed_size.replace(/_/g, ' ')}
            </span>
          )}
          {room.max_occupancy > 1 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white/5 text-foreground-variant border border-white/10">
              <span className="material-symbols-outlined text-[14px]">group</span>
              Sleeps {room.max_occupancy}
            </span>
          )}
        </div>
        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status.color]}`}>
          {status.label}
        </span>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 border-t border-border space-y-3">
              {room.photos?.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                  {room.photos.map((url, i) => (
                    <a key={i} href={url} download={`${room.unit_code}-${i + 1}.jpg`} className="flex-shrink-0 relative group">
                      <img
                        src={url}
                        alt={`${room.unit_code} photo ${i + 1}`}
                        className="w-32 h-24 rounded-lg object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 rounded-lg transition-colors flex items-center justify-center">
                        <span className="material-symbols-outlined text-white opacity-0 group-hover:opacity-100 transition-opacity text-lg">download</span>
                      </div>
                    </a>
                  ))}
                </div>
              )}

              {/* Pricing tiers */}
              {room.price_monthly && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-accent mb-2">Pricing by Lease Length</p>
                  <div className="grid grid-cols-4 gap-2">
                    {getPricingTiers(room.price_monthly).map((tier) => (
                      <div
                        key={tier.label}
                        className={`rounded-lg p-2 text-center ${
                          tier.highlight
                            ? 'bg-accent text-white'
                            : 'bg-surface-container text-foreground'
                        }`}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{tier.label}</p>
                        <p className="text-sm font-bold">${tier.price.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                  {room.next_available && (
                    <div className="mt-2 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2">
                      <p className="text-xs font-semibold text-amber-300">
                        Early bird: $50 off first 2 months if booked before {formatDate(room.next_available)}
                      </p>
                      <p className="text-[10px] text-amber-400/80 mt-0.5">
                        Commit before current lease ends. Total saving: $100.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <Detail label="Floor" value={room.floor} />
                <Detail label="Bed" value={room.bed_size?.replace(/_/g, ' ')} />
                <Detail label="Furnishing" value={room.furnishing_level?.replace(/_/g, ' ')} />
                <Detail label="Deposit" value={room.deposit_months ? `${room.deposit_months} month${room.deposit_months > 1 ? 's' : ''}` : null} />
                <Detail label="Min stay" value={room.min_stay_months ? `${room.min_stay_months} months` : null} />
                <Detail label="Max pax" value={room.max_occupancy ? `${room.max_occupancy} ${room.max_occupancy > 1 ? 'people' : 'person'}` : null} />
              </div>

              {room.amenities?.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-accent mb-1">Amenities</p>
                  <div className="flex flex-wrap gap-1.5">
                    {room.amenities.map((a, i) => (
                      <span key={i} className="px-2 py-0.5 bg-white/5 text-foreground-variant border border-white/10 text-xs rounded-full">{a}</span>
                    ))}
                  </div>
                </div>
              )}

              {room.facilities?.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-accent mb-1">Facilities</p>
                  <div className="flex flex-wrap gap-1.5">
                    {room.facilities.map((f, i) => (
                      <span key={i} className="px-2 py-0.5 bg-emerald-500/15 text-emerald-300 text-xs rounded-full">{f}</span>
                    ))}
                  </div>
                </div>
              )}

              {room.description && (
                <p className="text-sm text-foreground italic">{room.description}</p>
              )}

              {/* Upcoming bookings from Millia */}
              {room.upcoming_bookings?.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-accent mb-1.5">Upcoming Bookings</p>
                  <div className="space-y-1.5">
                    {room.upcoming_bookings.map((b, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg ${
                          b.overlap
                            ? 'bg-red-500/10 border border-red-500/25'
                            : 'bg-surface-container border border-border'
                        }`}
                      >
                        <span className={`font-medium ${b.overlap ? 'text-red-300' : 'text-foreground'}`}>
                          {formatDate(b.checkin)} → {formatDate(b.checkout)}
                        </span>
                        <div className="flex items-center gap-2">
                          {b.overlap && (
                            <span className="px-1.5 py-0.5 bg-red-500/20 text-red-300 text-[10px] font-bold rounded uppercase">
                              Overlap
                            </span>
                          )}
                          <span className="text-foreground capitalize">{b.channel}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PropertySection({ property }) {
  const p = property;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isCurrent = t => t.is_active && Number(t.monthly_rent) > 0 && new Date(t.moved_in_at) <= today;
  return (
    <div className="space-y-8">
      <div className="bg-surface rounded-2xl p-6 md:p-8 border border-border">
        <h2 className="font-display text-2xl font-bold text-foreground mb-1">{p.name}</h2>
        <p className="text-foreground text-sm mb-2">{p.address}</p>
        <div className="flex gap-4 mb-4 text-sm">
          <span className="text-foreground"><span className="font-semibold text-foreground">{p.rooms?.filter(isLettable).length || 0}</span> rooms</span>
          <span className="text-foreground">
            <span className="font-semibold text-foreground">
              {p.rooms?.reduce((count, r) => count + (r.tenant_profiles?.filter(isCurrent).length || 0), 0)}
            </span> tenants
          </span>
        </div>
        {p.description && <p className="text-foreground mb-6">{p.description}</p>}

        {/* Tenant Composition */}
        {(() => {
          const allTenants = p.rooms?.flatMap(r =>
            (r.tenant_profiles || []).filter(isCurrent).map(t => ({
              ...t,
              nationality: t.tenant_details?.nationality,
              name: t.tenant_details?.full_name || t.username,
            }))
          ) || [];
          if (allTenants.length === 0) return null;
          return (
            <div className="mb-6 bg-surface-container rounded-xl p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-accent mb-3">Housemates</h3>
              <div className="space-y-1.5">
                {allTenants.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${t.gender === 'F' ? 'bg-pink-500/20 text-pink-300' : 'bg-blue-500/20 text-blue-300'}`}>
                      {t.gender || '?'}
                    </span>
                    <span className="text-base">{getFlag(t.nationality)}</span>
                    <span className="text-foreground">{t.name}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {p.facilities?.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-accent mb-2">Facilities</h3>
              <div className="flex flex-wrap gap-1.5">
                {p.facilities.map((f, i) => (
                  <span key={i} className="inline-block px-2.5 py-1 bg-white/5 text-foreground-variant border border-white/10 text-xs rounded-full">{f}</span>
                ))}
              </div>
            </div>
          )}

          {p.nearby_mrt?.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-accent mb-2">Nearest MRT</h3>
              <ul className="space-y-1">
                {p.nearby_mrt.map((m, i) => (
                  <li key={i} className="text-sm text-foreground">
                    <span className="font-medium">{m.station}</span> ({m.line}) — {m.walking_minutes} min walk
                  </li>
                ))}
              </ul>
            </div>
          )}

          {p.nearby_amenities?.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-accent mb-2">Nearby</h3>
              <ul className="space-y-1">
                {p.nearby_amenities.map((a, i) => (
                  <li key={i} className="text-sm text-foreground">
                    <span className="font-medium">{a.name}</span> — {a.walking_minutes} min walk
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {p.house_rules?.length > 0 && (
          <div className="mt-6 pt-6 border-t border-border">
            <h3 className="text-xs font-bold uppercase tracking-wider text-accent mb-2">House Rules</h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {p.house_rules.map((rule, i) => (
                <li key={i} className="text-sm text-foreground flex items-start gap-2">
                  <span className="text-accent mt-0.5">•</span> {rule}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Map + Property Photos */}
        <div className="mt-6 pt-6 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-6">
          {p.latitude && p.longitude && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-accent mb-2">Location</h3>
              <div className="rounded-xl overflow-hidden h-48 border border-border relative z-0">
                <MapContainer
                  center={[parseFloat(p.latitude), parseFloat(p.longitude)]}
                  zoom={15}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={false}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[parseFloat(p.latitude), parseFloat(p.longitude)]} />
                </MapContainer>
              </div>
            </div>
          )}

          {p.images?.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-accent mb-2">Common Areas</h3>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {p.images.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    download={`${p.code}-common-${i + 1}.jpg`}
                    className="flex-shrink-0 relative group"
                  >
                    <img
                      src={url}
                      alt={`${p.name} common area ${i + 1}`}
                      className="w-40 h-28 rounded-lg object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 rounded-lg transition-colors flex items-center justify-center">
                      <span className="material-symbols-outlined text-white opacity-0 group-hover:opacity-100 transition-opacity text-lg">download</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="font-display text-xl font-bold text-foreground mb-4">
          Rooms ({p.rooms?.filter(isLettable).length || 0})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {p.rooms?.filter(isLettable).map(room => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TermCard({ title, value, subtitle }) {
  return (
    <div className="bg-surface-container rounded-xl p-5 text-center">
      <p className="text-xs font-bold uppercase tracking-wider text-accent mb-1">{title}</p>
      <p className="text-xl font-bold text-foreground font-display">{value}</p>
      {subtitle && <p className="text-xs text-foreground mt-1">{subtitle}</p>}
    </div>
  );
}

function LeaseTermsSection() {
  return (
    <section className="bg-surface py-16">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <h2 className="font-display text-2xl font-bold text-foreground mb-6">Lease Terms</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <TermCard title="Minimum Stay" value="3 months" />
          <TermCard title="Deposit" value="1 month rent" subtitle="Fully refundable" />
          <TermCard title="Notice Period" value="1 month" />
          <TermCard title="Payment" value="Bank transfer" subtitle="Due 1st of each month" />
        </div>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-accent mb-2">Rent Includes</h3>
            <ul className="space-y-1.5 text-sm text-foreground">
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> High-speed WiFi</li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> Utilities (water, electricity with AC allowance)</li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> Weekly common area cleaning</li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> Fully furnished room</li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> Cooking facilities</li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> Washing machine &amp; dryer access</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-red-400 mb-2">Not Included</h3>
            <ul className="space-y-1.5 text-sm text-foreground">
              <li className="flex items-start gap-2"><span className="text-red-400 mt-0.5">✗</span> Personal AC usage over monthly allowance</li>
              <li className="flex items-start gap-2"><span className="text-red-400 mt-0.5">✗</span> Personal toiletries &amp; bedroom cleaning</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function MoveInProcessSection() {
  const steps = [
    { num: '1', title: 'Browse & Schedule', desc: 'Browse available rooms online or schedule a viewing at the property.' },
    { num: '2', title: 'Sign Agreement', desc: 'Choose your room and sign the digital licence agreement.' },
    { num: '3', title: 'Pay Deposit', desc: "Pay security deposit + first month's rent via bank transfer." },
    { num: '4', title: 'Get Access', desc: 'Receive your door code and move-in instructions.' },
    { num: '5', title: 'Move In', desc: 'Move in on your start date. Welcome to Lazybee!' },
  ];

  return (
    <section className="py-16 bg-surface-container">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <h2 className="font-display text-2xl font-bold text-foreground mb-8">Move-in Process</h2>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          {steps.map(step => (
            <div key={step.num} className="bg-surface rounded-xl p-5 text-center border border-border">
              <div className="w-8 h-8 rounded-full bg-accent text-white font-bold text-sm flex items-center justify-center mx-auto mb-3">
                {step.num}
              </div>
              <p className="font-semibold text-foreground text-sm mb-1">{step.title}</p>
              <p className="text-xs text-foreground">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  const faqs = [
    { q: 'Can I have guests overnight?', a: 'Yes, overnight guests are allowed with advance notice to your housemates. Extended stays (3+ nights) require approval.' },
    { q: "What's the WiFi speed?", a: 'All properties have high-speed fibre broadband (300Mbps+). Each room has strong coverage.' },
    { q: 'Is cooking allowed?', a: 'Yes, the shared kitchen is fully equipped. Please clean up after cooking and use the exhaust fan when cooking with strong spices.' },
    { q: 'How do I report a maintenance issue?', a: 'Submit a ticket through the Lazybee tenant portal, or message us on WhatsApp. We aim to respond within 24 hours.' },
    { q: 'Can I end my lease early?', a: 'Early termination requires 1 month written notice. The security deposit may be forfeited depending on circumstances.' },
    { q: 'What happens to my deposit?', a: 'Your deposit is fully refundable within 14 days of move-out, subject to a room condition inspection. Deductions apply for damages beyond normal wear and tear.' },
    { q: 'Are utilities included?', a: 'Yes — water, electricity (with a monthly AC allowance), WiFi, and weekly common area cleaning are all included in rent. AC usage above the allowance is charged separately.' },
    { q: 'Is there parking?', a: 'Chiltern Park and Ivory Heights have nearby HDB parking. Thomson Grove has limited porch parking. Check with us for availability.' },
    { q: "What's the AC usage policy?", a: 'Each room has a monthly AC allowance included in rent. Usage is tracked via smart plugs. Overage is billed monthly at the prevailing electricity rate.' },
  ];

  return (
    <section className="py-16 bg-surface">
      <div className="max-w-3xl mx-auto px-6 md:px-8">
        <h2 className="font-display text-2xl font-bold text-foreground mb-6">Frequently Asked Questions</h2>
        <Accordion type="single" collapsible>
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-left text-foreground font-medium">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-foreground">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

function RoomSearch({ search, setSearch, resultCount }) {
  const set = (k, v) => setSearch((s) => ({ ...s, [k]: v }));
  const active = isSearchActive(search);
  const fieldCls =
    'w-full rounded-full border border-white/10 bg-background/60 px-4 py-2.5 text-sm text-foreground placeholder:text-foreground-variant/40 outline-none focus:border-accent transition-colors';
  const labelCls = 'block text-[10px] uppercase tracking-[0.25em] text-foreground-variant font-semibold mb-2';

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-2xl p-5 md:p-6 mb-8">
      <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr_1.2fr] gap-4 items-end">
        {/* Move-in date + fixed/flexible */}
        <div>
          <label className={labelCls}>Move-in date</label>
          <div className="flex gap-2">
            <input type="date" value={search.date} onChange={(e) => set('date', e.target.value)} className={`${fieldCls} flex-1`} />
            <div className="inline-flex rounded-full border border-white/10 overflow-hidden shrink-0">
              {['fixed', 'flexible'].map((mode) => (
                <button
                  key={mode} type="button" onClick={() => set('dateMode', mode)}
                  className={`px-3 text-xs capitalize transition-colors ${search.dateMode === mode ? 'bg-accent text-accent-foreground font-semibold' : 'text-foreground-variant hover:text-foreground'}`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>
        {/* Budget ±200 */}
        <div>
          <label className={labelCls}>Budget (±${BUDGET_BAND})</label>
          <input type="number" inputMode="numeric" value={search.budget} onChange={(e) => set('budget', e.target.value)} placeholder="e.g. 1200" className={fieldCls} />
        </div>
        {/* Location */}
        <div>
          <label className={labelCls}>Location</label>
          <select value={search.location} onChange={(e) => set('location', e.target.value)} className={`${fieldCls} appearance-none cursor-pointer`}>
            {LOCATIONS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
      </div>
      {active && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-foreground-variant">
            {resultCount} room{resultCount === 1 ? '' : 's'} across all properties
          </span>
          <button onClick={() => setSearch(EMPTY_SEARCH)} className="text-xs font-semibold text-accent hover:underline">
            Clear search
          </button>
        </div>
      )}
    </div>
  );
}

export default function StaffResourcePage() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState(EMPTY_SEARCH);

  useEffect(() => {
    async function fetchData() {
      const [propRes, tenantRes] = await Promise.all([
        supabase.from('properties').select('*, rooms(*)').order('name'),
        supabase.from('tenant_profiles')
          .select('room_id, username, gender, is_active, monthly_rent, moved_in_at, lease_end, tenant_details(full_name, nationality)')
          .eq('is_active', true),
      ]);
      if (propRes.error) {
        setError(propRes.error.message);
      } else {
        const tenantsByRoom = {};
        (tenantRes.data || []).forEach(t => {
          if (!tenantsByRoom[t.room_id]) tenantsByRoom[t.room_id] = [];
          tenantsByRoom[t.room_id].push(t);
        });
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sorted = PROPERTY_ORDER.map(code => propRes.data.find(p => p.code === code)).filter(Boolean);
        sorted.forEach(p => {
          if (p.rooms) {
            p.rooms.sort((a, b) => a.unit_code.localeCompare(b.unit_code));
            p.rooms.forEach(r => {
              const roomTenants = tenantsByRoom[r.id] || [];
              r.tenant_profiles = roomTenants;
              const avail = computeRoomAvailability(r, roomTenants, today);
              r.next_available = avail.next_available;
              r.available_until = avail.available_until;
              r.upcoming_bookings = avail.upcoming_bookings;
            });
          }
        });
        setProperties(sorted);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-background text-foreground pt-24 md:pt-28 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background text-foreground pt-24 md:pt-28 px-6">
        <div className="max-w-7xl mx-auto text-center py-20">
          <p className="text-red-400">Failed to load data: {error}</p>
        </div>
      </main>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const searchActive = isSearchActive(search);
  const results = searchActive
    ? properties
        .flatMap((p) => (p.rooms || []).filter(isLettable).map((room) => ({ room, property: p })))
        .filter(({ room, property }) => roomMatchesSearch(room, property.code, search, today))
        .sort((a, b) => (a.room.price_monthly || 0) - (b.room.price_monthly || 0))
    : [];

  return (
    <main className="min-h-screen bg-background text-foreground pt-24 md:pt-28">
      <SEO
        title="Staff Resources"
        noindex
      />

      <section className="px-6 md:px-8 py-12 max-w-7xl mx-auto">
        <span className="block text-[11px] uppercase tracking-[0.4em] font-semibold text-accent mb-4">Internal · Sales &amp; ops</span>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-display text-foreground mb-2">
          Staff Resource Guide
        </h1>
        <p className="text-foreground-variant text-lg">
          Live room details and availability — pull pricing, beds, and move-in dates fast.
        </p>
      </section>

      <section className="px-6 md:px-8 max-w-7xl mx-auto pb-16">
        <RoomSearch search={search} setSearch={setSearch} resultCount={results.length} />

        {searchActive ? (
          results.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map(({ room, property }) => (
                <RoomCard key={room.id} room={room} property={property} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-foreground-variant">
              No rooms match. Try widening the budget or switching dates to <span className="text-accent">flexible</span>.
            </div>
          )
        ) : (
          properties.length > 0 && (
            <Tabs defaultValue={properties[0].code}>
              <TabsList className="mb-8 w-full sm:w-auto">
                {properties.map(p => (
                  <TabsTrigger key={p.code} value={p.code} className="px-6 py-2.5 text-sm font-semibold">
                    {p.code} — {p.name}
                  </TabsTrigger>
                ))}
              </TabsList>

              {properties.map(p => (
                <TabsContent key={p.code} value={p.code}>
                  <PropertySection property={p} />
                </TabsContent>
              ))}
            </Tabs>
          )
        )}
      </section>
    </main>
  );
}
