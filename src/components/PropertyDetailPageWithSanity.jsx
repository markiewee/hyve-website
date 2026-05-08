import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { client, QUERIES, urlFor } from '../lib/cms';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import ApiService from '../services/api';
import SEO from './SEO';
import HousematePreview from './HousematePreview';
import {
  LAZYBEE_FALLBACK_PROPERTIES,
  LAZYBEE_FALLBACK_ROOMS,
  LAZYBEE_FALLBACK_HERO_IMAGE,
} from '../data/lazybeeFallback';

// Fix default marker icon issue with bundlers
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Lazybee teal map marker
const propertyMarkerIcon = new L.DivIcon({
  className: 'custom-property-marker',
  html: `<div style="
    width: 36px; height: 36px;
    background: #006b5f;
    border: 3px solid #fff;
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    display: flex; align-items: center; justify-content: center;
  ">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -20],
});

// Supabase property ID mapping (Sanity slug -> Supabase UUID)
const PROPERTY_ID_MAP = {
  'chiltern-park': '1d1cff29-0542-4520-bcf7-dfe0f7e8cb48',
  'ivory-heights': '358c5333-00fd-4efb-b330-3d6e131e9b10',
  'thomson-grove': 'd3e7e40f-a32c-4c8e-a54f-59e8f9cbc4a6',
};

// Curated nearby places per property
const NEARBY_PLACES = {
  'chiltern-park': [
    { icon: 'shopping_bag', name: 'NEX Shopping Mall', time: '5 min' },
    { icon: 'restaurant', name: 'Chomp Chomp Food Centre', time: '8 min' },
    { icon: 'local_mall', name: 'myVillage', time: '6 min' },
    { icon: 'fitness_center', name: 'ActiveSG Gym', time: '10 min' },
    { icon: 'park', name: 'Serangoon Garden', time: '5 min' },
    { icon: 'local_hospital', name: 'Sengkang General Hospital', time: '12 min' },
    { icon: 'school', name: 'Nanyang JC', time: '7 min' },
    { icon: 'local_grocery_store', name: 'FairPrice Finest', time: '4 min' },
  ],
  'ivory-heights': [
    { icon: 'local_mall', name: 'Westgate Mall', time: '5 min' },
    { icon: 'shopping_bag', name: 'JEM', time: '6 min' },
    { icon: 'storefront', name: 'IMM Outlet Mall', time: '8 min' },
    { icon: 'park', name: 'Jurong Lake Gardens', time: '10 min' },
    { icon: 'restaurant', name: 'Yuhua Market & Hawker', time: '4 min' },
    { icon: 'local_hospital', name: 'Ng Teng Fong Hospital', time: '7 min' },
    { icon: 'school', name: 'NUS (Buona Vista)', time: '15 min' },
    { icon: 'local_grocery_store', name: 'Giant Supermarket', time: '3 min' },
  ],
  'thomson-grove': [
    { icon: 'local_mall', name: 'Thomson Plaza', time: '8 min' },
    { icon: 'shopping_bag', name: 'Ang Mo Kio Hub', time: '10 min' },
    { icon: 'park', name: 'Lower Peirce Reservoir', time: '12 min' },
    { icon: 'restaurant', name: 'Ang Mo Kio 628 Market', time: '7 min' },
    { icon: 'fitness_center', name: 'ActiveSG Gym', time: '10 min' },
    { icon: 'local_hospital', name: 'AMK-Thye Hua Kwan Hospital', time: '11 min' },
    { icon: 'forest', name: 'Windsor Nature Park', time: '15 min' },
    { icon: 'local_grocery_store', name: 'FairPrice', time: '5 min' },
  ],
};

// ---- What's Included icon definitions ----
const UNIVERSAL_ICONS = [
  { icon: 'bolt', label: 'Utilities Included' },
  { icon: 'wifi', label: 'High-Speed WiFi' },
  { icon: 'cleaning_services', label: 'Weekly Cleaning' },
  { icon: 'chair', label: 'Fully Furnished' },
  { icon: 'ac_unit', label: 'Aircon' },
  { icon: 'kitchen', label: 'Shared Kitchen' },
];

const FACILITY_ICONS = [
  { icon: 'pool', label: 'Swimming Pool', match: ['pool', 'swimming pool', 'swimming'] },
  { icon: 'fitness_center', label: 'Gym', match: ['gym', 'fitness', 'fitness center', 'gymnasium'] },
  { icon: 'local_parking', label: 'Parking', match: ['parking', 'car park', 'carpark'] },
  { icon: 'toys', label: 'Playground', match: ['playground', 'play area'] },
  { icon: 'lock', label: '24hr Security', match: ['security', '24hr security', '24-hour security', 'cctv'] },
];

const LIFESTYLE_ICONS = [
  { icon: 'pets', label: 'Pets Welcome' },
  { icon: 'group', label: 'Couples Allowed' },
  { icon: 'local_laundry_service', label: 'Laundry' },
  { icon: 'train', label: 'Near MRT' },
  { icon: 'money_off', label: 'No Agent Fees' },
  { icon: 'event_available', label: 'Flexible Lease (3mo)' },
];

const PropertyDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [property, setProperty] = useState(null);
  const [propertyRooms, setPropertyRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [showAllPhotos, setShowAllPhotos] = useState(false);
  const [requestFormData, setRequestFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [moveInDate, setMoveInDate] = useState('');

  useEffect(() => {
    const fetchPropertyData = async () => {
      try {
        setLoading(true);
        let sanityProperty = null;
        let sanityRooms = [];

        try {
          sanityProperty = await client.fetch(QUERIES.propertyDetail, { id });

          if (sanityProperty) {
            sanityRooms = await client.fetch(QUERIES.roomsByProperty, {
              propertyId: sanityProperty._id
            });
          }
        } catch (sanityError) {
          console.log('Sanity fetch failed, trying API/sample data:', sanityError);
        }

        if (sanityProperty) {
          setProperty(sanityProperty);
          setPropertyRooms(sanityRooms);
        } else if (LAZYBEE_FALLBACK_PROPERTIES[id]) {
          console.warn(`Property "${id}" not found in Sanity — using hardcoded fallback.`);
          setProperty(LAZYBEE_FALLBACK_PROPERTIES[id]);
          setPropertyRooms(LAZYBEE_FALLBACK_ROOMS[id] || []);
        } else {
          try {
            const [propertyData, roomsData] = await Promise.all([
              ApiService.getProperty(id),
              ApiService.getPropertyRooms(id)
            ]);
            setProperty(propertyData);
            setPropertyRooms(roomsData);
          } catch (error) {
            console.error('API failed, using sample data:', error);
            const { properties, rooms } = await import('../data/sampleData');
            const sampleProperty = properties.find(p =>
              p.id === parseInt(id) || p.id === id || p.slug === id
            );
            const sampleRooms = rooms.filter(r =>
              r.propertyId === parseInt(id) || r.propertyId === id
            );
            setProperty(sampleProperty);
            setPropertyRooms(sampleRooms);
          }
        }
      } catch (error) {
        console.error('Error fetching property data:', error);
        if (LAZYBEE_FALLBACK_PROPERTIES[id]) {
          setProperty(LAZYBEE_FALLBACK_PROPERTIES[id]);
          setPropertyRooms(LAZYBEE_FALLBACK_ROOMS[id] || []);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPropertyData();
  }, [id]);

  const nextImage = () => {
    if (property?.images?.length > 0) {
      setCurrentImageIndex((prev) =>
        prev === property.images.length - 1 ? 0 : prev + 1
      );
    }
  };

  const prevImage = () => {
    if (property?.images?.length > 0) {
      setCurrentImageIndex((prev) =>
        prev === 0 ? property.images.length - 1 : prev - 1
      );
    }
  };

  const formatRoomType = (type) => {
    if (!type) return '';
    const map = {
      single: 'Standard Room',
      common: 'Premium Room',
      master: 'Master Bedroom',
      loft: 'Loft Room',
    };
    return map[type.toLowerCase()] || type;
  };

  const slugKey = property?.slug?.current || id;
  const localHero = LAZYBEE_FALLBACK_HERO_IMAGE[slugKey];
  const GENERIC_HERO_FALLBACK =
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&h=800&fit=crop&q=80';
  const GENERIC_ROOM_FALLBACK =
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop&q=80';

  const safeUrlFor = (img, w, h) => {
    try {
      return urlFor(img).width(w).height(h).url();
    } catch (err) {
      console.warn('urlFor failed:', err);
      return null;
    }
  };

  const getImageSrc = (imageObj, w, h) => {
    if (imageObj?.image) {
      return safeUrlFor(imageObj.image, w, h) || localHero || GENERIC_HERO_FALLBACK;
    }
    if (typeof imageObj === 'string') return `/${imageObj}`;
    return localHero || GENERIC_HERO_FALLBACK;
  };

  const getCurrentImageSrc = () => {
    if (!property?.images?.length) return localHero || GENERIC_HERO_FALLBACK;
    return getImageSrc(property.images[currentImageIndex], 1200, 800);
  };

  const getRoomImageSrc = (room) => {
    if (room?.images?.[0]?.image) {
      return safeUrlFor(room.images[0].image, 800, 600) || localHero || GENERIC_ROOM_FALLBACK;
    }
    if (typeof room?.images?.[0] === 'string') return `/${room.images[0]}`;
    return localHero || GENERIC_ROOM_FALLBACK;
  };

  const formatAvailableDate = (dateString) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };

  const formatAvailableDateShort = (dateString) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (error) {
      return dateString;
    }
  };

  const handleRoomRequest = (room) => {
    const slug = property?.slug?.current || id;
    const roomCode = room.unit_code || room.roomNumber;
    navigate(`/view/schedule/${slug}/${roomCode}`);
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    setRequestLoading(true);
    try {
      const roomType = selectedRoom.availableFrom ? 'Waitlist Request' : 'Room Request';
      const availabilityInfo = selectedRoom.availableFrom
        ? `Available from: ${formatAvailableDate(selectedRoom.availableFrom)}`
        : 'Currently occupied';

      const message = `\u{1F3E0} *${roomType}* from Lazybee Website

*Property:* ${property.name}
*Room:* ${selectedRoom.roomNumber} (${formatRoomType(selectedRoom.roomType)})
*Monthly Rent:* $${selectedRoom.priceMonthly}
*Availability:* ${availabilityInfo}

*Prospect Details:*
\u{1F464} *Name:* ${requestFormData.name}
\u{1F4E7} *Email:* ${requestFormData.email}
\u{1F4F1} *Phone:* ${requestFormData.phone}

*Message:*
${requestFormData.message || 'No additional message provided'}

*Submitted via:* Lazybee Website
*Time:* ${new Date().toLocaleString()}`;

      const phoneNumber = '6580885410';
      const encodedMessage = encodeURIComponent(message);
      window.open(`https://wa.me/${phoneNumber}?text=${encodedMessage}`, '_blank');

      setRequestSubmitted(true);
      setTimeout(() => {
        setShowRequestDialog(false);
        setRequestSubmitted(false);
        setRequestFormData({ name: '', email: '', phone: '', message: '' });
      }, 3000);
    } catch (error) {
      console.error('Error creating WhatsApp message:', error);
      alert('There was an error creating your request. Please try again.');
    } finally {
      setRequestLoading(false);
    }
  };

  // Resolve Supabase property ID for housemates
  const supabasePropertyId = useMemo(() => {
    if (!property) return null;
    const slug = property.slug?.current || id;
    // Try the slug mapping first
    if (PROPERTY_ID_MAP[slug]) return PROPERTY_ID_MAP[slug];
    // Fall back to the Sanity document _id (they should match)
    return property._id || null;
  }, [property, id]);

  // Facility icons filtered by property amenities
  const facilityIcons = useMemo(() => {
    if (!property?.amenities) return [];
    const amenitiesLower = property.amenities.map(a => a.toLowerCase());
    return FACILITY_ICONS.filter(f =>
      f.match.some(m => amenitiesLower.some(a => a.includes(m)))
    );
  }, [property?.amenities]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] pt-20">
        <div className="animate-pulse">
          <div className="h-[500px] bg-slate-200"></div>
          <div className="max-w-7xl mx-auto px-8 py-12 grid grid-cols-1 lg:grid-cols-3 gap-16">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-8 bg-slate-200 rounded w-2/3"></div>
              <div className="h-4 bg-slate-200 rounded w-full"></div>
              <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            </div>
            <div className="space-y-4">
              <div className="h-64 bg-slate-200 rounded-2xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] pt-24 flex flex-col items-center justify-center px-8">
        <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">home_work</span>
        <h1 className="text-4xl font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] mb-4">Property Not Found</h1>
        <p className="text-lg text-[#3c4947] mb-8">Sorry, we couldn&apos;t find the property you&apos;re looking for.</p>
        <Link
          to="/properties"
          className="bg-[#006b5f] text-white px-8 py-4 rounded-xl font-['Plus_Jakarta_Sans'] font-bold hover:opacity-90 transition-all"
        >
          View All Properties
        </Link>
      </div>
    );
  }

  const neighborhoodName = typeof property.neighborhood === 'string'
    ? property.neighborhood
    : property.neighborhood?.name || '';

  const filteredRooms = moveInDate
    ? propertyRooms.filter(room => {
        if (room.isAvailable) return true;
        if (room.availableFrom) {
          return new Date(room.availableFrom) <= new Date(moveInDate);
        }
        return false;
      })
    : propertyRooms;

  const availableRooms = filteredRooms.filter(room => room.isAvailable);
  const unavailableRooms = filteredRooms.filter(room => !room.isAvailable);

  const computedStartingPrice = propertyRooms.length > 0
    ? Math.min(...propertyRooms.map(r => r.priceMonthly).filter(Boolean))
    : property.startingPrice;
  const displayStartingPrice = computedStartingPrice || property.startingPrice;

  const todayStr = new Date().toISOString().split('T')[0];

  const images = property.images || [];
  const galleryThumbs = images.slice(1, 5);
  const remainingPhotos = images.length - 5;

  // MRT info for overlay
  const primaryMRT = property.nearbyMRT?.[0];
  const mrtLabel = primaryMRT
    ? `${primaryMRT.station || primaryMRT} ${primaryMRT.walkingMinutes ? `(${primaryMRT.walkingMinutes} min walk)` : ''}`
    : null;

  // Map location
  const propertyLat = property.location?.latitude || property.latitude;
  const propertyLng = property.location?.longitude || property.longitude;
  const hasLocation = propertyLat && propertyLng;

  return (
    <>
      <SEO
        title={property?.name}
        description={property?.description?.slice(0, 155)}
        canonical={`/property/${property?._id}`}
        type="article"
        ogImage={property?.images?.[0]?.image ? (safeUrlFor(property.images[0].image, 1200, 630) || undefined) : undefined}
        schema={property ? {
          "@context": "https://schema.org",
          "@type": "Apartment",
          "name": `${property.name} — Lazybee Coliving`,
          "description": property.description,
          "address": {
            "@type": "PostalAddress",
            "streetAddress": property.address,
            "addressLocality": property.neighborhood?.name,
            "addressCountry": "SG"
          },
          "numberOfRooms": property.totalRooms,
          "amenityFeature": (property.amenities || []).map(a => ({
            "@type": "LocationFeatureSpecification",
            "name": a,
            "value": true
          })),
          "offers": {
            "@type": "AggregateOffer",
            "lowPrice": displayStartingPrice,
            "priceCurrency": "SGD",
            "unitText": "MONTH",
            "availability": property.availableRooms > 0
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock"
          }
        } : undefined}
      />

      <div className="min-h-screen bg-[#f8f9ff] pt-20">
        {/* ==================== HERO GALLERY ==================== */}
        <section className="relative">
          {/* Desktop Gallery Grid */}
          <div className="hidden md:block px-4 md:px-8 pt-6 pb-0">
            <div className="max-w-7xl mx-auto grid grid-cols-5 grid-rows-2 gap-2 h-[480px] lg:h-[540px] rounded-2xl overflow-hidden relative">
              {/* Main image — left 60% (3 of 5 cols), full height */}
              <div
                className="col-span-3 row-span-2 relative overflow-hidden cursor-pointer group"
                onClick={() => setShowAllPhotos(true)}
              >
                <img
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  src={getImageSrc(images[0], 1200, 800)}
                  alt={property.name}
                  loading="eager"
                  onError={(e) => {
                    if (e.currentTarget.dataset.fallbackUsed !== '1') {
                      e.currentTarget.dataset.fallbackUsed = '1';
                      e.currentTarget.src = localHero || GENERIC_HERO_FALLBACK;
                    }
                  }}
                />
              </div>

              {/* Right 40% — 4 thumbnail grid (2x2) */}
              {galleryThumbs.map((img, i) => (
                <div
                  key={i}
                  className="relative overflow-hidden cursor-pointer group"
                  onClick={() => { setCurrentImageIndex(i + 1); setShowAllPhotos(true); }}
                >
                  <img
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    src={getImageSrc(img, 600, 400)}
                    alt={img?.alt || `${property.name} photo ${i + 2}`}
                    loading="lazy"
                  />
                  {/* "+X Photos" overlay on last thumbnail */}
                  {i === galleryThumbs.length - 1 && remainingPhotos > 0 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center hover:bg-black/40 transition-colors">
                      <span className="text-white font-['Plus_Jakarta_Sans'] font-bold text-lg">
                        +{remainingPhotos} Photos
                      </span>
                    </div>
                  )}
                </div>
              ))}

              {/* Fill empty thumbnail slots if fewer than 4 side images */}
              {galleryThumbs.length < 4 && Array.from({ length: 4 - galleryThumbs.length }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-slate-100" />
              ))}

              {/* Rooms available badge — top-left */}
              {availableRooms.length > 0 && (
                <div className="absolute top-4 left-4 z-10">
                  <span className="bg-[#006b5f] text-white px-4 py-2 rounded-full text-sm font-['Inter'] font-bold shadow-lg">
                    {availableRooms.length} {availableRooms.length === 1 ? 'room' : 'rooms'} available
                  </span>
                </div>
              )}

              {/* Bottom overlay bar */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-8 pb-6 pt-16 z-10 col-span-5">
                <div className="flex items-end justify-between">
                  <div>
                    <h1 className="text-white text-3xl lg:text-4xl font-['Plus_Jakarta_Sans'] font-extrabold tracking-tight">
                      {property.name}
                    </h1>
                    <div className="flex items-center gap-3 mt-2 text-white/80 font-['Manrope'] text-sm">
                      {neighborhoodName && <span>{neighborhoodName}</span>}
                      {mrtLabel && (
                        <>
                          <span className="text-white/40">|</span>
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">train</span>
                            {mrtLabel}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white/60 font-['Inter'] text-xs uppercase tracking-widest">From</p>
                    <p className="text-white text-2xl font-['Plus_Jakarta_Sans'] font-extrabold">
                      ${displayStartingPrice}<span className="text-base font-normal text-white/70">/mo</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Carousel */}
          <div className="md:hidden relative">
            <div className="relative h-[320px] overflow-hidden">
              <img
                className="w-full h-full object-cover"
                src={getCurrentImageSrc()}
                alt={property.name}
                loading="eager"
                onError={(e) => {
                  if (e.currentTarget.dataset.fallbackUsed !== '1') {
                    e.currentTarget.dataset.fallbackUsed = '1';
                    e.currentTarget.src = localHero || GENERIC_HERO_FALLBACK;
                  }
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

              {/* Rooms badge */}
              {availableRooms.length > 0 && (
                <div className="absolute top-4 left-4">
                  <span className="bg-[#006b5f] text-white px-3 py-1.5 rounded-full text-xs font-['Inter'] font-bold">
                    {availableRooms.length} {availableRooms.length === 1 ? 'room' : 'rooms'} available
                  </span>
                </div>
              )}

              {/* Image counter */}
              {images.length > 1 && (
                <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-xs font-['Inter']">
                  {currentImageIndex + 1} / {images.length}
                </div>
              )}

              {/* Nav arrows */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-1.5 rounded-full"
                  >
                    <span className="material-symbols-outlined text-lg">chevron_left</span>
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-1.5 rounded-full"
                  >
                    <span className="material-symbols-outlined text-lg">chevron_right</span>
                  </button>
                </>
              )}

              {/* Bottom info */}
              <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
                <h1 className="text-white text-2xl font-['Plus_Jakarta_Sans'] font-extrabold">
                  {property.name}
                </h1>
                <p className="text-white/80 font-['Manrope'] text-sm mt-1">
                  {neighborhoodName} &bull; From ${displayStartingPrice}/mo
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== CONTENT GRID ==================== */}
        <section className="max-w-7xl mx-auto px-4 md:px-8 grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16 pt-10 pb-24">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-12 md:space-y-16">
            {/* Description */}
            <div>
              <h2 className="text-3xl font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] mb-6">
                About This Property
              </h2>
              <div className="space-y-4 text-[#3c4947] leading-relaxed font-['Manrope']">
                <p>{property.description || `Experience modern coliving at ${property.name}. Located in the heart of ${neighborhoodName}, this property offers everything you need for comfortable urban living.`}</p>
              </div>
            </div>

            {/* ==================== WHAT'S INCLUDED ==================== */}
            <div>
              <h3 className="text-2xl font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] mb-6">
                What&apos;s Included
              </h3>

              {/* All icons in a single clean grid — icon + label inline */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4">
                {[...UNIVERSAL_ICONS, ...facilityIcons, ...LIFESTYLE_ICONS].map((item) => (
                  <div key={item.icon} className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[22px] text-[#006b5f] flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
                    <span className="text-sm font-['Manrope'] text-[#3c4947] font-medium">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ==================== MEET YOUR HOUSEMATES ==================== */}
            {supabasePropertyId && (
              <HousematePreview propertyId={supabasePropertyId} />
            )}

            {/* ==================== ROOM LISTINGS ==================== */}
            {propertyRooms && propertyRooms.length > 0 && (
              <div>
                <div className="flex justify-between items-end mb-4">
                  <h3 className="text-2xl font-['Plus_Jakarta_Sans'] font-bold">Individual Suites</h3>
                  <span className="text-[#006b5f] font-['Inter'] text-sm font-bold uppercase tracking-wider">
                    {availableRooms.length} Available Now
                  </span>
                </div>

                {/* Move-in date search */}
                <div className="bg-white p-4 rounded-xl border border-[rgba(187,202,198,0.15)] mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex items-center gap-2 text-[#3c4947]">
                    <span className="material-symbols-outlined text-[#006b5f]">search</span>
                    <label htmlFor="moveInDate" className="text-sm font-['Inter'] font-medium whitespace-nowrap">
                      I want to move in by
                    </label>
                  </div>
                  <input
                    id="moveInDate"
                    type="date"
                    min={todayStr}
                    value={moveInDate}
                    onChange={(e) => setMoveInDate(e.target.value)}
                    className="bg-[#eff4ff] border-transparent rounded-lg px-4 py-2 text-sm font-['Inter'] focus:ring-2 focus:ring-[#006b5f] focus:border-transparent outline-none flex-1 min-w-0 w-full sm:w-auto"
                  />
                  {moveInDate && (
                    <button
                      onClick={() => setMoveInDate('')}
                      className="text-xs text-[#006b5f] font-['Inter'] font-bold uppercase tracking-wider hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {/* No results for date filter */}
                  {moveInDate && filteredRooms.length === 0 && (
                    <div className="text-center py-8">
                      <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">event_busy</span>
                      <p className="text-[#3c4947] font-['Manrope']">No rooms available by {formatAvailableDate(moveInDate)}</p>
                      <button
                        onClick={() => setMoveInDate('')}
                        className="text-[#006b5f] font-['Inter'] font-bold text-sm mt-2 hover:underline"
                      >
                        Show all rooms
                      </button>
                    </div>
                  )}

                  {/* Available rooms */}
                  {availableRooms
                    .sort((a, b) => (a.roomNumber || '').localeCompare(b.roomNumber || ''))
                    .map((room) => (
                    <div
                      key={room._id || room.id}
                      className="bg-white p-4 md:p-6 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between border border-[rgba(187,202,198,0.15)] hover:border-[#006b5f]/30 transition-colors gap-4"
                    >
                      <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto">
                        <div className="w-28 h-28 md:w-40 md:h-32 rounded-xl overflow-hidden flex-shrink-0">
                          <img
                            className="w-full h-full object-cover"
                            src={getRoomImageSrc(room)}
                            alt={`Room ${room.roomNumber}`}
                            loading="lazy"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-lg">{room.roomNumber}</h4>
                            <span className="bg-emerald-50 text-emerald-700 text-[10px] font-['Inter'] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                              Available Now
                            </span>
                          </div>
                          <p className="text-[#3c4947] text-sm flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">square_foot</span>
                            {formatRoomType(room.roomType)}
                          </p>
                          <div className="mt-3 md:hidden">
                            <p className="text-2xl font-['Plus_Jakarta_Sans'] font-extrabold text-[#006b5f]">
                              ${room.priceMonthly}<span className="text-sm font-normal text-[#3c4947]">/mo</span>
                            </p>
                            <p className="text-[10px] text-[#6c7a77] font-['Inter']">per month, all-inclusive</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-left md:text-right flex flex-row md:flex-col items-center md:items-end gap-3 md:gap-2 w-full md:w-auto justify-between">
                        <div className="hidden md:block">
                          <p className="text-2xl font-['Plus_Jakarta_Sans'] font-extrabold text-[#006b5f]">
                            ${room.priceMonthly}<span className="text-sm font-normal text-[#3c4947]">/mo</span>
                          </p>
                          <p className="text-[10px] text-[#6c7a77] font-['Inter']">per month, all-inclusive</p>
                        </div>
                        <button
                          onClick={() => handleRoomRequest(room)}
                          className="bg-[#006b5f] text-white px-5 py-2.5 rounded-full text-[10px] font-['Inter'] font-bold uppercase tracking-widest hover:bg-[#006b5f]/90 transition-colors"
                        >
                          Book Viewing
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Unavailable rooms */}
                  {unavailableRooms.length > 0 && (
                    <>
                      <div className="pt-4">
                        <p className="text-sm text-[#555f6f] font-['Inter'] uppercase tracking-widest font-bold mb-4">
                          Coming Soon ({unavailableRooms.filter(r => r.availableFrom).length})
                        </p>
                      </div>
                      {unavailableRooms
                        .sort((a, b) => {
                          if (a.availableFrom && b.availableFrom) return new Date(a.availableFrom) - new Date(b.availableFrom);
                          if (a.availableFrom) return -1;
                          if (b.availableFrom) return 1;
                          return (a.roomNumber || '').localeCompare(b.roomNumber || '');
                        })
                        .map((room) => (
                        <div
                          key={room._id || room.id}
                          className="bg-white/60 p-4 md:p-6 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between border border-[rgba(187,202,198,0.15)] gap-4 opacity-80"
                        >
                          <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto">
                            <div className="w-28 h-28 md:w-40 md:h-32 rounded-xl overflow-hidden flex-shrink-0">
                              <img
                                className="w-full h-full object-cover"
                                src={getRoomImageSrc(room)}
                                alt={`Room ${room.roomNumber}`}
                                loading="lazy"
                              />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-lg">{room.roomNumber}</h4>
                                {room.availableFrom ? (
                                  <>
                                    <span className="bg-amber-50 text-amber-700 text-[10px] font-['Inter'] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                                      Available {formatAvailableDateShort(room.availableFrom)}
                                    </span>
                                    {(() => {
                                      const avail = new Date(room.availableFrom);
                                      const now = new Date();
                                      const diffMonths = (avail.getFullYear() - now.getFullYear()) * 12 + (avail.getMonth() - now.getMonth());
                                      if (diffMonths <= 3) {
                                        return (
                                          <span className="bg-rose-50 text-rose-600 text-[10px] font-['Inter'] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[12px]">local_fire_department</span>
                                            Move In Now — Special Rate
                                          </span>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </>
                                ) : (
                                  <span className="bg-slate-100 text-slate-500 text-[10px] font-['Inter'] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                                    Occupied
                                  </span>
                                )}
                              </div>
                              <p className="text-[#3c4947] text-sm">{formatRoomType(room.roomType)}</p>
                              <div className="mt-3 md:hidden">
                                <p className="text-2xl font-['Plus_Jakarta_Sans'] font-extrabold text-[#006b5f]">
                                  ${room.priceMonthly}<span className="text-sm font-normal text-[#3c4947]">/mo</span>
                                </p>
                                <p className="text-[10px] text-[#6c7a77] font-['Inter']">per month, all-inclusive</p>
                              </div>
                            </div>
                          </div>
                          <div className="text-left md:text-right flex flex-row md:flex-col items-center md:items-end gap-3 md:gap-2 w-full md:w-auto justify-between">
                            <div className="hidden md:block">
                              <p className="text-2xl font-['Plus_Jakarta_Sans'] font-extrabold text-[#006b5f]">
                                ${room.priceMonthly}<span className="text-sm font-normal text-[#3c4947]">/mo</span>
                              </p>
                              <p className="text-[10px] text-[#6c7a77] font-['Inter']">per month, all-inclusive</p>
                            </div>
                            <button
                              onClick={() => handleRoomRequest(room)}
                              className="bg-[#006b5f] text-white px-5 py-2.5 rounded-full text-[10px] font-['Inter'] font-bold uppercase tracking-widest hover:bg-[#006b5f]/90 transition-colors"
                            >
                              Enquire
                            </button>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ==================== LOCATION MINI-MAP ==================== */}
            {hasLocation && (
              <div>
                <h3 className="text-2xl font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] mb-6">
                  Location &amp; Transport
                </h3>
                <div className="rounded-2xl overflow-hidden border border-[rgba(187,202,198,0.15)]" style={{ height: '300px' }}>
                  <MapContainer
                    center={[parseFloat(propertyLat), parseFloat(propertyLng)]}
                    zoom={15}
                    style={{ height: '100%', width: '100%' }}
                    scrollWheelZoom={false}
                    dragging={true}
                    zoomControl={true}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
                      url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                      className="lazybee-map-tiles"
                    />
                    <Marker
                      position={[parseFloat(propertyLat), parseFloat(propertyLng)]}
                      icon={propertyMarkerIcon}
                    />
                  </MapContainer>
                </div>

                {/* MRT badges below map */}
                {property.nearbyMRT && property.nearbyMRT.length > 0 && (
                  <div className="flex flex-wrap gap-3 mt-4">
                    {property.nearbyMRT.map((mrt, index) => (
                      <div key={index} className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-[rgba(187,202,198,0.15)]">
                        <span className="material-symbols-outlined text-[#006b5f] text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>train</span>
                        <span className="font-['Inter'] text-sm font-medium text-[#121c2a]">
                          {mrt.station || mrt}
                        </span>
                        {mrt.walkingMinutes && (
                          <span className="text-[#6c7a77] text-xs font-['Inter']">
                            {mrt.walkingMinutes} min walk
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Nearby places grid */}
                {NEARBY_PLACES[id] && (
                  <div className="mt-6">
                    <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-3">What's Nearby</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {NEARBY_PLACES[id].map((place, index) => (
                        <div key={index} className="flex items-center gap-2.5 bg-white px-3 py-2.5 rounded-xl border border-[rgba(187,202,198,0.15)]">
                          <span className="material-symbols-outlined text-[#006b5f] text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>{place.icon}</span>
                          <div className="min-w-0">
                            <p className="font-['Manrope'] text-xs font-medium text-[#121c2a] truncate">{place.name}</p>
                            <p className="font-['Inter'] text-[10px] text-[#6c7a77]">{place.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Nearby MRT (fallback if no map location) */}
            {!hasLocation && property.nearbyMRT && property.nearbyMRT.length > 0 && (
              <div>
                <h3 className="text-2xl font-['Plus_Jakarta_Sans'] font-bold mb-6">Nearby MRT</h3>
                <div className="flex flex-wrap gap-3">
                  {property.nearbyMRT.map((mrt, index) => (
                    <div key={index} className="flex items-center gap-2 bg-[#dee9fc] px-4 py-2 rounded-xl">
                      <span className="material-symbols-outlined text-[#006b5f] text-sm">train</span>
                      <span className="font-['Inter'] text-sm font-medium text-[#121c2a]">
                        {mrt.station || mrt} {mrt.walkingMinutes ? `(${mrt.walkingMinutes} min walk)` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ==================== SOCIAL PROOF ==================== */}
            <div className="bg-white rounded-2xl border border-[rgba(187,202,198,0.15)] p-8">
              <div className="text-center mb-8">
                <p className="text-[10px] font-['Inter'] font-bold uppercase tracking-[0.2em] text-[#006b5f] mb-2">
                  Social Proof
                </p>
                <h3 className="text-2xl font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a]">
                  Trusted by 50+ residents across Singapore
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#f8f9ff] rounded-xl p-6">
                  <div className="flex items-center gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map(i => (
                      <span key={i} className="material-symbols-outlined text-amber-400 text-lg">star</span>
                    ))}
                  </div>
                  <p className="text-[#3c4947] font-['Manrope'] text-sm leading-relaxed mb-4">
                    &ldquo;Moving to Singapore was daunting, but Lazybee made it so easy. Everything is included in the rent, the housemates are great, and the location is perfect for getting around.&rdquo;
                  </p>
                  <p className="font-['Inter'] text-xs font-bold text-[#006b5f]">
                    Priya, 26 &mdash; Thomson Grove
                  </p>
                </div>
                <div className="bg-[#f8f9ff] rounded-xl p-6">
                  <div className="flex items-center gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map(i => (
                      <span key={i} className="material-symbols-outlined text-amber-400 text-lg">star</span>
                    ))}
                  </div>
                  <p className="text-[#3c4947] font-['Manrope'] text-sm leading-relaxed mb-4">
                    &ldquo;Best value co-living in Singapore. The weekly cleaning, fast WiFi, and fully furnished rooms meant I could just move in and start living. No hidden costs either.&rdquo;
                  </p>
                  <p className="font-['Inter'] text-xs font-bold text-[#006b5f]">
                    Marcus, 28 &mdash; Ivory Heights
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ==================== RIGHT COLUMN: STICKY SIDEBAR ==================== */}
          <div className="lg:col-span-1">
            <div className="sticky top-28 space-y-8">
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-[rgba(187,202,198,0.15)]">
                {/* Price */}
                <div className="mb-6">
                  <p className="text-[10px] font-['Inter'] font-bold uppercase tracking-widest text-[#6c7a77] mb-1">
                    Starting from
                  </p>
                  <p className="text-3xl font-['Plus_Jakarta_Sans'] font-extrabold text-[#006b5f]">
                    ${displayStartingPrice}<span className="text-lg font-normal text-[#3c4947]">/mo</span>
                  </p>
                  <p className="text-xs text-[#6c7a77] font-['Inter'] mt-1">All-inclusive, no hidden fees</p>
                </div>

                <h4 className="text-xl font-['Plus_Jakarta_Sans'] font-extrabold text-[#121c2a] mb-2">
                  Book a Viewing
                </h4>
                <p className="text-[#3c4947] text-sm mb-6 font-['Manrope']">
                  Tour the space and meet your potential housemates.
                </p>
                <div className="space-y-3">
                  <Link
                    to={`/view/schedule/${property.slug?.current || id}`}
                    className="w-full bg-[#006b5f] text-white py-4 rounded-xl font-['Plus_Jakarta_Sans'] font-bold text-lg hover:bg-[#006b5f]/90 transition-all active:scale-95 shadow-lg shadow-[#006b5f]/20 flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined">calendar_month</span>
                    Schedule a Viewing
                  </Link>
                  <a
                    href={`https://wa.me/6580885410?text=${encodeURIComponent(`Hi! I'm interested in viewing ${property.name}.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full border border-[rgba(187,202,198,0.3)] text-[#121c2a] py-4 rounded-xl font-['Plus_Jakarta_Sans'] font-bold text-lg hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined">chat</span>
                    WhatsApp Us
                  </a>
                </div>

                <div className="mt-6 pt-6 border-t border-[rgba(187,202,198,0.15)] flex items-center justify-between">
                  <p className="text-[10px] font-['Inter'] text-[#3c4947] font-bold uppercase tracking-widest">
                    {propertyRooms.length} TOTAL ROOMS
                  </p>
                  <p className="text-[10px] font-['Inter'] text-[#006b5f] font-bold uppercase tracking-widest">
                    {availableRooms.length} AVAILABLE
                  </p>
                </div>
              </div>

              {/* Back to properties */}
              <Link
                to="/properties"
                className="flex items-center gap-2 text-[#006b5f] font-['Plus_Jakarta_Sans'] font-bold hover:-translate-x-1 transition-all"
              >
                <span className="material-symbols-outlined">arrow_back</span>
                Back to Properties
              </Link>
            </div>
          </div>
        </section>

        {/* ==================== MOBILE STICKY BOTTOM BAR ==================== */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#bbcac6] px-4 py-3 z-40 flex items-center justify-between gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div>
            <p className="text-xs text-[#6c7a77] font-['Inter']">From</p>
            <p className="text-xl font-['Plus_Jakarta_Sans'] font-extrabold text-[#006b5f]">
              ${displayStartingPrice}<span className="text-sm font-normal text-[#3c4947]">/mo</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`https://wa.me/6580885410?text=${encodeURIComponent(`Hi! I'm interested in ${property.name}.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 flex items-center justify-center rounded-full border border-[#bbcac6] text-[#006b5f]"
              aria-label="WhatsApp"
            >
              <span className="material-symbols-outlined text-lg">chat</span>
            </a>
            <Link
              to={`/view/schedule/${property.slug?.current || id}`}
              className="bg-[#006b5f] text-white px-5 py-3 rounded-full font-['Plus_Jakarta_Sans'] font-bold text-sm hover:bg-[#006b5f]/90 transition-all active:scale-95 shadow-lg shadow-[#006b5f]/20"
            >
              Schedule Viewing
            </Link>
          </div>
        </div>
        {/* Spacer for mobile bottom bar */}
        <div className="lg:hidden h-20" />
      </div>

      {/* ==================== FULL-SCREEN PHOTO GALLERY MODAL ==================== */}
      {showAllPhotos && (
        <div className="fixed inset-0 bg-black z-50 overflow-y-auto">
          <div className="sticky top-0 bg-black/90 backdrop-blur-sm z-10 flex items-center justify-between px-6 py-4">
            <h3 className="text-white font-['Plus_Jakarta_Sans'] font-bold text-lg">
              {property.name} &mdash; All Photos ({images.length})
            </h3>
            <button
              onClick={() => setShowAllPhotos(false)}
              className="text-white/80 hover:text-white p-2"
            >
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>
          </div>
          <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
            {images.map((img, i) => (
              <div key={i} className="rounded-xl overflow-hidden">
                <img
                  className="w-full object-contain max-h-[80vh]"
                  src={getImageSrc(img, 1400, 900)}
                  alt={img?.alt || `${property.name} photo ${i + 1}`}
                  loading={i < 3 ? 'eager' : 'lazy'}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== ROOM REQUEST DIALOG ==================== */}
      {showRequestDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 relative">
            <button
              onClick={() => {
                setShowRequestDialog(false);
                setRequestSubmitted(false);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            {requestSubmitted ? (
              <div className="text-center py-8">
                <span className="material-symbols-outlined text-6xl text-[#14b8a6] mb-4 block">check_circle</span>
                <h3 className="text-xl font-['Plus_Jakarta_Sans'] font-bold mb-2">Request Sent!</h3>
                <p className="text-[#3c4947]">We&apos;ll be in touch shortly.</p>
              </div>
            ) : (
              <>
                <h3 className="text-2xl font-['Plus_Jakarta_Sans'] font-extrabold mb-2">
                  {selectedRoom?.isAvailable ? 'Request Room' : 'Enquire'}
                </h3>
                <p className="text-sm text-[#3c4947] mb-6">
                  {selectedRoom?.roomNumber} &bull; ${selectedRoom?.priceMonthly}/mo
                </p>
                <form onSubmit={handleRequestSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-['Inter'] font-bold uppercase tracking-widest text-[#3c4947] mb-2">
                      Full Name
                    </label>
                    <input
                      required
                      type="text"
                      value={requestFormData.name}
                      onChange={(e) => setRequestFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-[#eff4ff] border-transparent rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#006b5f] focus:border-transparent outline-none"
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-['Inter'] font-bold uppercase tracking-widest text-[#3c4947] mb-2">
                        Email
                      </label>
                      <input
                        required
                        type="email"
                        value={requestFormData.email}
                        onChange={(e) => setRequestFormData(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full bg-[#eff4ff] border-transparent rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#006b5f] focus:border-transparent outline-none"
                        placeholder="admin@lazybee.sg"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-['Inter'] font-bold uppercase tracking-widest text-[#3c4947] mb-2">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={requestFormData.phone}
                        onChange={(e) => setRequestFormData(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full bg-[#eff4ff] border-transparent rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#006b5f] focus:border-transparent outline-none"
                        placeholder="+65 8088 5410"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-['Inter'] font-bold uppercase tracking-widest text-[#3c4947] mb-2">
                      Message (optional)
                    </label>
                    <textarea
                      value={requestFormData.message}
                      onChange={(e) => setRequestFormData(prev => ({ ...prev, message: e.target.value }))}
                      className="w-full bg-[#eff4ff] border-transparent rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#006b5f] focus:border-transparent outline-none h-24 resize-none"
                      placeholder="Tell us about yourself..."
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={requestLoading}
                    className="w-full bg-[#006b5f] text-white py-4 rounded-xl font-['Plus_Jakarta_Sans'] font-bold text-lg hover:bg-[#006b5f]/90 transition-all active:scale-95 shadow-lg shadow-[#006b5f]/20 disabled:opacity-50"
                  >
                    {requestLoading ? 'Sending...' : 'Request Access'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default PropertyDetailPage;
