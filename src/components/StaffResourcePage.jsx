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
  'Other': '🏳️',
};

function getFlag(nationality) {
  if (!nationality) return '🏳️';
  return NAT_TO_FLAG[nationality] || '🏳️';
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
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
};

function Detail({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between">
      <span className="text-[#3c4947]">{label}</span>
      <span className="text-[#121c2a] font-medium capitalize">{value}</span>
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
  let next_available = null;
  let available_until = null;

  if (current.length >= maxOccupancy) {
    const earliestEnd = current
      .map(t => t.lease_end)
      .filter(Boolean)
      .sort()[0];
    if (earliestEnd) {
      const d = new Date(earliestEnd);
      d.setDate(d.getDate() + 1);
      next_available = d.toISOString().slice(0, 10);
    }
  } else if (future.length > 0) {
    const d = new Date(future[0].moved_in_at);
    d.setDate(d.getDate() - 1);
    available_until = d.toISOString().slice(0, 10);
  }

  const upcoming_bookings = future.map(t => ({
    checkin: t.moved_in_at,
    checkout: t.lease_end,
    channel: 'Direct',
    overlap: maxOccupancy === 1 && current.some(c =>
      c.lease_end && new Date(t.moved_in_at) < new Date(c.lease_end)
    ),
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

function RoomCard({ room }) {
  const [expanded, setExpanded] = useState(false);
  const status = getAvailabilityStatus(room);
  const isAvailable = status.color === 'green' || status.color === 'amber' && !room.next_available;
  const roomTypeLabel = room.room_type
    ? room.room_type.charAt(0).toUpperCase() + room.room_type.slice(1)
    : '—';

  return (
    <div
      className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] text-base">{room.unit_code}</h3>
            <p className="text-sm text-[#3c4947]">{room.name}</p>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
        <div className="flex items-center gap-3 text-sm mb-2 flex-wrap">
          {room.price_monthly && (
            <span className="font-semibold text-[#121c2a]">${room.price_monthly.toLocaleString()}/mo</span>
          )}
          {room.size_sqm && (
            <span className="text-[#3c4947]">{room.size_sqm} sqm</span>
          )}
          <span className="text-[#3c4947]">{roomTypeLabel}</span>
          {room.bed_size && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 capitalize">
              <span className="material-symbols-outlined text-[14px]">bed</span>
              {room.bed_size.replace(/_/g, ' ')}
            </span>
          )}
          {room.has_private_bathroom && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700">
              <span className="material-symbols-outlined text-[14px]">bathtub</span>
              Ensuite
            </span>
          )}
          {room.max_occupancy > 1 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
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
            <div className="px-4 pb-4 pt-2 border-t border-gray-100 space-y-3">
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
                  <p className="text-xs font-bold uppercase tracking-wider text-[#006b5f] mb-2">Pricing by Lease Length</p>
                  <div className="grid grid-cols-4 gap-2">
                    {getPricingTiers(room.price_monthly).map((tier) => (
                      <div
                        key={tier.label}
                        className={`rounded-lg p-2 text-center ${
                          tier.highlight
                            ? 'bg-[#006b5f] text-white'
                            : 'bg-gray-50 text-[#121c2a]'
                        }`}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{tier.label}</p>
                        <p className="text-sm font-bold">${tier.price.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                  {room.next_available && (
                    <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <p className="text-xs font-semibold text-amber-800">
                        Early bird: $50 off first 2 months if booked before {formatDate(room.next_available)}
                      </p>
                      <p className="text-[10px] text-amber-600 mt-0.5">
                        Commit before current lease ends. Total saving: $100.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <Detail label="Floor" value={room.floor} />
                <Detail label="Bed" value={room.bed_size?.replace(/_/g, ' ')} />
                <Detail label="Bathroom" value={room.has_private_bathroom ? 'Private (Ensuite)' : 'Shared'} />
                <Detail label="Aircon" value={room.has_aircon ? 'Yes' : 'No'} />
                <Detail label="Furnishing" value={room.furnishing_level?.replace(/_/g, ' ')} />
                <Detail label="Deposit" value={room.deposit_months ? `${room.deposit_months} month${room.deposit_months > 1 ? 's' : ''}` : null} />
                <Detail label="Min stay" value={room.min_stay_months ? `${room.min_stay_months} months` : null} />
                <Detail label="Max pax" value={room.max_occupancy ? `${room.max_occupancy} ${room.max_occupancy > 1 ? 'people' : 'person'}` : null} />
              </div>

              {room.amenities?.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#006b5f] mb-1">Amenities</p>
                  <div className="flex flex-wrap gap-1.5">
                    {room.amenities.map((a, i) => (
                      <span key={i} className="px-2 py-0.5 bg-[#eff4ff] text-[#121c2a] text-xs rounded-full">{a}</span>
                    ))}
                  </div>
                </div>
              )}

              {room.facilities?.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#006b5f] mb-1">Facilities</p>
                  <div className="flex flex-wrap gap-1.5">
                    {room.facilities.map((f, i) => (
                      <span key={i} className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-xs rounded-full">{f}</span>
                    ))}
                  </div>
                </div>
              )}

              {room.description && (
                <p className="text-sm text-[#3c4947] italic">{room.description}</p>
              )}

              {/* Upcoming bookings from Millia */}
              {room.upcoming_bookings?.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#006b5f] mb-1.5">Upcoming Bookings</p>
                  <div className="space-y-1.5">
                    {room.upcoming_bookings.map((b, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg ${
                          b.overlap
                            ? 'bg-red-50 border border-red-200'
                            : 'bg-gray-50 border border-gray-200'
                        }`}
                      >
                        <span className={`font-medium ${b.overlap ? 'text-red-800' : 'text-[#121c2a]'}`}>
                          {formatDate(b.checkin)} → {formatDate(b.checkout)}
                        </span>
                        <div className="flex items-center gap-2">
                          {b.overlap && (
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded uppercase">
                              Overlap
                            </span>
                          )}
                          <span className="text-[#3c4947] capitalize">{b.channel}</span>
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
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100">
        <h2 className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#121c2a] mb-1">{p.name}</h2>
        <p className="text-[#3c4947] text-sm mb-2">{p.address}</p>
        <div className="flex gap-4 mb-4 text-sm">
          <span className="text-[#3c4947]"><span className="font-semibold text-[#121c2a]">{p.rooms?.length || 0}</span> rooms</span>
          {p.num_bathrooms && <span className="text-[#3c4947]"><span className="font-semibold text-[#121c2a]">{p.num_bathrooms}</span> bathroom{p.num_bathrooms > 1 ? 's' : ''}</span>}
          <span className="text-[#3c4947]">
            <span className="font-semibold text-[#121c2a]">
              {p.rooms?.reduce((count, r) => count + (r.tenant_profiles?.filter(isCurrent).length || 0), 0)}
            </span> tenants
          </span>
        </div>
        {p.description && <p className="text-[#3c4947] mb-6 font-['Manrope']">{p.description}</p>}

        {/* Tenant Composition */}
        {(() => {
          const allTenants = p.rooms?.flatMap(r =>
            (r.tenant_profiles || []).filter(isCurrent).map(t => ({
              ...t,
              nationality: t.tenant_details?.[0]?.nationality,
              name: t.tenant_details?.[0]?.full_name || t.username,
            }))
          ) || [];
          if (allTenants.length === 0) return null;
          return (
            <div className="mb-6 bg-[#f8f9ff] rounded-xl p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#006b5f] mb-3">Housemates</h3>
              <div className="space-y-1.5">
                {allTenants.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${t.gender === 'F' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'}`}>
                      {t.gender || '?'}
                    </span>
                    <span className="text-base">{getFlag(t.nationality)}</span>
                    <span className="text-[#121c2a]">{t.name}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {p.facilities?.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#006b5f] mb-2">Facilities</h3>
              <div className="flex flex-wrap gap-1.5">
                {p.facilities.map((f, i) => (
                  <span key={i} className="inline-block px-2.5 py-1 bg-[#eff4ff] text-[#121c2a] text-xs rounded-full">{f}</span>
                ))}
              </div>
            </div>
          )}

          {p.nearby_mrt?.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#006b5f] mb-2">Nearest MRT</h3>
              <ul className="space-y-1">
                {p.nearby_mrt.map((m, i) => (
                  <li key={i} className="text-sm text-[#3c4947]">
                    <span className="font-medium">{m.station}</span> ({m.line}) — {m.walking_minutes} min walk
                  </li>
                ))}
              </ul>
            </div>
          )}

          {p.nearby_amenities?.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#006b5f] mb-2">Nearby</h3>
              <ul className="space-y-1">
                {p.nearby_amenities.map((a, i) => (
                  <li key={i} className="text-sm text-[#3c4947]">
                    <span className="font-medium">{a.name}</span> — {a.walking_minutes} min walk
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {p.house_rules?.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#006b5f] mb-2">House Rules</h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {p.house_rules.map((rule, i) => (
                <li key={i} className="text-sm text-[#3c4947] flex items-start gap-2">
                  <span className="text-[#006b5f] mt-0.5">•</span> {rule}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Map + Property Photos */}
        <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-6">
          {p.latitude && p.longitude && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#006b5f] mb-2">Location</h3>
              <div className="rounded-xl overflow-hidden h-48 border border-gray-200 relative z-0">
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
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#006b5f] mb-2">Common Areas</h3>
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
        <h2 className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-[#121c2a] mb-4">
          Rooms ({p.rooms?.length || 0})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {p.rooms?.map(room => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TermCard({ title, value, subtitle }) {
  return (
    <div className="bg-[#f8f9ff] rounded-xl p-5 text-center">
      <p className="text-xs font-bold uppercase tracking-wider text-[#006b5f] mb-1">{title}</p>
      <p className="text-xl font-bold text-[#121c2a] font-['Plus_Jakarta_Sans']">{value}</p>
      {subtitle && <p className="text-xs text-[#3c4947] mt-1">{subtitle}</p>}
    </div>
  );
}

function LeaseTermsSection() {
  return (
    <section className="bg-white py-16">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <h2 className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#121c2a] mb-6">Lease Terms</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <TermCard title="Minimum Stay" value="3 months" />
          <TermCard title="Deposit" value="1 month rent" subtitle="Fully refundable" />
          <TermCard title="Notice Period" value="1 month" />
          <TermCard title="Payment" value="Bank transfer" subtitle="Due 1st of each month" />
        </div>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#006b5f] mb-2">Rent Includes</h3>
            <ul className="space-y-1.5 text-sm text-[#3c4947]">
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span> High-speed WiFi</li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span> Utilities (water, electricity with AC allowance)</li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span> Weekly common area cleaning</li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span> Fully furnished room</li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span> Cooking facilities</li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span> Washing machine &amp; dryer access</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-red-600 mb-2">Not Included</h3>
            <ul className="space-y-1.5 text-sm text-[#3c4947]">
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
    <section className="py-16 bg-[#f8f9ff]">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <h2 className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#121c2a] mb-8">Move-in Process</h2>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          {steps.map(step => (
            <div key={step.num} className="bg-white rounded-xl p-5 text-center shadow-sm border border-gray-100">
              <div className="w-8 h-8 rounded-full bg-[#006b5f] text-white font-bold text-sm flex items-center justify-center mx-auto mb-3">
                {step.num}
              </div>
              <p className="font-semibold text-[#121c2a] text-sm mb-1">{step.title}</p>
              <p className="text-xs text-[#3c4947]">{step.desc}</p>
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
    <section className="py-16 bg-white">
      <div className="max-w-3xl mx-auto px-6 md:px-8">
        <h2 className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#121c2a] mb-6">Frequently Asked Questions</h2>
        <Accordion type="single" collapsible>
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-left text-[#121c2a] font-medium">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-[#3c4947]">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

export default function StaffResourcePage() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      <div className="min-h-screen bg-[#f8f9ff] pt-24 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#006b5f]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] pt-24 px-6">
        <div className="max-w-7xl mx-auto text-center py-20">
          <p className="text-red-600">Failed to load data: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9ff] pt-24">
      <SEO
        title="Staff Resource Guide"
        description="Internal reference for Lazybee sales and operations staff."
        noindex={true}
      />

      <section className="px-6 md:px-8 py-12 max-w-7xl mx-auto">
        <h1 className="font-['Plus_Jakarta_Sans'] text-3xl sm:text-4xl font-extrabold tracking-tight text-[#121c2a] mb-2">
          Staff Resource Guide
        </h1>
        <p className="text-[#3c4947] text-lg font-['Manrope']">
          Quick reference for sales &amp; ops — room details, availability, and policies.
        </p>
      </section>

      <section className="px-6 md:px-8 max-w-7xl mx-auto pb-16">
        {properties.length > 0 && (
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
        )}
      </section>

      <LeaseTermsSection />
      <MoveInProcessSection />
      <FAQSection />
    </div>
  );
}
