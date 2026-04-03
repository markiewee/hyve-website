import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { client, QUERIES, urlFor } from '../lib/sanity';
import ApiService from '../services/api';
import SEO from './SEO';

const PropertyDetailPage = () => {
  const { id } = useParams();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [property, setProperty] = useState(null);
  const [propertyRooms, setPropertyRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [requestFormData, setRequestFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);

  useEffect(() => {
    const fetchPropertyData = async () => {
      try {
        setLoading(true);
        let sanityProperty = null;
        let sanityRooms = [];

        try {
          sanityProperty = await client.fetch(`
            *[_type == "property" && (slug.current == $id || _id == $id)][0]{
              _id,
              name,
              slug,
              description,
              address,
              neighborhood->{
                name,
                slug,
                description,
                highlights,
                transport,
                amenities
              },
              location,
              propertyType,
              startingPrice,
              totalRooms,
              availableRooms,
              images[]{
                image,
                alt,
                caption
              },
              amenities,
              nearbyMRT[],
              nearbyAmenities[],
              status,
              featured
            }
          `, { id });

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

  const getCurrentImageSrc = () => {
    if (!property?.images?.length) return 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&h=800&fit=crop&q=80';
    const currentImage = property.images[currentImageIndex];
    if (currentImage?.image) {
      return urlFor(currentImage.image).width(1200).height(800).url();
    }
    return `/${currentImage}`;
  };

  const getRoomImageSrc = (room) => {
    if (room.images?.[0]?.image) {
      return urlFor(room.images[0].image).width(800).height(600).url();
    }
    if (room.images?.[0]) return `/${room.images[0]}`;
    return 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop&q=80';
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

  const handleRoomRequest = (room) => {
    setSelectedRoom(room);
    setShowRequestDialog(true);
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    setRequestLoading(true);
    try {
      const roomType = selectedRoom.availableFrom ? 'Waitlist Request' : 'Room Request';
      const availabilityInfo = selectedRoom.availableFrom
        ? `Available from: ${formatAvailableDate(selectedRoom.availableFrom)}`
        : 'Currently occupied';

      const message = `🏠 *${roomType}* from Hyve Website

*Property:* ${property.name}
*Room:* ${selectedRoom.roomNumber} (${selectedRoom.roomType})
*Monthly Rent:* $${selectedRoom.priceMonthly}
*Availability:* ${availabilityInfo}

*Prospect Details:*
👤 *Name:* ${requestFormData.name}
📧 *Email:* ${requestFormData.email}
📱 *Phone:* ${requestFormData.phone}

*Message:*
${requestFormData.message || 'No additional message provided'}

*Submitted via:* Hyve Website
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] pt-20">
        <div className="animate-pulse">
          <div className="h-[716px] bg-slate-200"></div>
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

  const neighborhoodName = property.neighborhood?.name || property.neighborhood;
  const availableRooms = propertyRooms.filter(room => room.isAvailable);
  const unavailableRooms = propertyRooms.filter(room => !room.isAvailable);

  return (
    <>
      <SEO
        title={property?.name}
        description={property?.description?.slice(0, 155)}
        canonical={`/property/${property?._id}`}
        type="article"
        ogImage={property?.images?.[0]?.image ? urlFor(property.images[0].image).width(1200).height(630).url() : undefined}
        schema={property ? {
          "@context": "https://schema.org",
          "@type": "Apartment",
          "name": `${property.name} — Hyve Coliving`,
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
            "lowPrice": property.startingPrice,
            "priceCurrency": "SGD",
            "unitText": "MONTH",
            "availability": property.availableRooms > 0
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock"
          }
        } : undefined}
      />

      {property && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Apartment",
          "name": `${property.name} — Hyve Coliving`,
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
            "lowPrice": property.startingPrice,
            "priceCurrency": "SGD",
            "unitText": "MONTH",
            "availability": property.availableRooms > 0
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock"
          }
        })}} />
      )}

      <div className="min-h-screen bg-[#f8f9ff] pt-20">
        {/* Hero Gallery */}
        <section className="px-4 md:px-8 pt-8 pb-12">
          <div className="grid grid-cols-12 grid-rows-2 gap-4 h-auto md:h-[500px] lg:h-[600px] max-w-7xl mx-auto">
            {/* Main image */}
            <div className="col-span-12 md:col-span-8 row-span-2 relative overflow-hidden rounded-xl group">
              <img
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 min-h-[300px]"
                src={getCurrentImageSrc()}
                alt={property.name}
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
              <div className="absolute bottom-8 left-8">
                <span className="bg-[#006b5f] text-white px-4 py-1 rounded-full text-xs font-['Inter'] tracking-widest uppercase mb-4 inline-block">
                  {property.propertyType || 'Coliving'}
                </span>
                <h1 className="text-white text-3xl md:text-5xl font-['Plus_Jakarta_Sans'] font-extrabold tracking-tight">
                  {property.name}
                </h1>
                <p className="text-white/80 font-['Manrope'] mt-2">
                  {neighborhoodName} &bull; From ${property.startingPrice}/mo
                </p>
              </div>
              {/* Image nav arrows */}
              {property.images && property.images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <span className="material-symbols-outlined">chevron_left</span>
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </>
              )}
            </div>
            {/* Side images */}
            {property.images && property.images.length > 1 && (
              <div
                className="hidden md:block col-span-4 row-span-1 relative overflow-hidden rounded-xl cursor-pointer"
                onClick={() => setCurrentImageIndex(1)}
              >
                <img
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                  src={property.images[1]?.image ? urlFor(property.images[1].image).width(600).height(400).url() : `/${property.images[1]}`}
                  alt={property.images[1]?.alt || `${property.name} photo 2`}
                  loading="lazy"
                />
              </div>
            )}
            {property.images && property.images.length > 2 && (
              <div
                className="hidden md:block col-span-4 row-span-1 relative overflow-hidden rounded-xl cursor-pointer"
                onClick={() => setCurrentImageIndex(2)}
              >
                <img
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                  src={property.images[2]?.image ? urlFor(property.images[2].image).width(600).height(400).url() : `/${property.images[2]}`}
                  alt={property.images[2]?.alt || `${property.name} photo 3`}
                  loading="lazy"
                />
                {property.images.length > 3 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white font-['Plus_Jakarta_Sans'] font-bold text-lg">
                      +{property.images.length - 3} Photos
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Content Grid */}
        <section className="max-w-7xl mx-auto px-4 md:px-8 grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16 pb-24">
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

            {/* Amenities */}
            {property.amenities && property.amenities.length > 0 && (
              <div>
                <h3 className="text-xl font-['Plus_Jakarta_Sans'] font-bold mb-6">Curated Amenities</h3>
                <div className="flex flex-wrap gap-3">
                  {property.amenities.map((amenity, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#dee9fc] text-[#555f6f]"
                    >
                      <span className="font-['Inter'] text-sm font-medium">{amenity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Room Listings */}
            {propertyRooms && propertyRooms.length > 0 && (
              <div>
                <div className="flex justify-between items-end mb-8">
                  <h3 className="text-2xl font-['Plus_Jakarta_Sans'] font-bold">Individual Suites</h3>
                  <span className="text-[#006b5f] font-['Inter'] text-sm font-bold uppercase tracking-wider">
                    {availableRooms.length} Available Now
                  </span>
                </div>
                <div className="space-y-4">
                  {/* Available rooms first */}
                  {availableRooms
                    .sort((a, b) => (a.roomNumber || '').localeCompare(b.roomNumber || ''))
                    .map((room) => (
                    <div
                      key={room._id || room.id}
                      className="bg-white p-4 md:p-6 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between border border-[rgba(187,202,198,0.15)] hover:border-[#006b5f]/30 transition-colors gap-4"
                    >
                      <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto">
                        <div className="w-20 h-20 md:w-24 md:h-24 rounded-lg overflow-hidden flex-shrink-0">
                          <img
                            className="w-full h-full object-cover"
                            src={getRoomImageSrc(room)}
                            alt={`Room ${room.roomNumber}`}
                            loading="lazy"
                          />
                        </div>
                        <div>
                          <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-lg">{room.roomNumber}</h4>
                          <p className="text-[#3c4947] text-sm flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">square_foot</span>
                            {room.roomType}
                          </p>
                        </div>
                      </div>
                      <div className="text-left md:text-right flex flex-row md:flex-col items-center md:items-end gap-3 md:gap-1 w-full md:w-auto justify-between">
                        <p className="text-2xl font-['Plus_Jakarta_Sans'] font-extrabold text-[#006b5f]">
                          ${room.priceMonthly}<span className="text-sm font-normal text-[#3c4947]">/mo</span>
                        </p>
                        <button
                          onClick={() => handleRoomRequest(room)}
                          className="bg-[#14b8a6]/20 text-[#00423b] px-4 py-1.5 rounded-full text-[10px] font-['Inter'] font-bold uppercase tracking-widest hover:bg-[#14b8a6]/30 transition-colors"
                        >
                          {room.isAvailable ? 'Available Now' : `Available ${formatAvailableDate(room.availableFrom)}`}
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Unavailable rooms */}
                  {unavailableRooms.length > 0 && (
                    <>
                      <div className="pt-4">
                        <p className="text-sm text-[#555f6f] font-['Inter'] uppercase tracking-widest font-bold mb-4">
                          Coming Soon ({unavailableRooms.length})
                        </p>
                      </div>
                      {unavailableRooms
                        .sort((a, b) => (a.roomNumber || '').localeCompare(b.roomNumber || ''))
                        .map((room) => (
                        <div
                          key={room._id || room.id}
                          className="bg-white/60 p-4 md:p-6 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between border border-[rgba(187,202,198,0.15)] gap-4 opacity-70"
                        >
                          <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto">
                            <div className="w-20 h-20 md:w-24 md:h-24 rounded-lg overflow-hidden flex-shrink-0">
                              <img
                                className="w-full h-full object-cover"
                                src={getRoomImageSrc(room)}
                                alt={`Room ${room.roomNumber}`}
                                loading="lazy"
                              />
                            </div>
                            <div>
                              <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-lg">{room.roomNumber}</h4>
                              <p className="text-[#3c4947] text-sm">{room.roomType}</p>
                            </div>
                          </div>
                          <div className="text-left md:text-right flex flex-row md:flex-col items-center md:items-end gap-3 md:gap-1 w-full md:w-auto justify-between">
                            <p className="text-2xl font-['Plus_Jakarta_Sans'] font-extrabold text-[#006b5f]">
                              ${room.priceMonthly}<span className="text-sm font-normal text-[#3c4947]">/mo</span>
                            </p>
                            <button
                              onClick={() => handleRoomRequest(room)}
                              className="bg-slate-200 text-slate-600 px-4 py-1.5 rounded-full text-[10px] font-['Inter'] font-bold uppercase tracking-widest hover:bg-slate-300 transition-colors"
                            >
                              {room.availableFrom ? `From ${formatAvailableDate(room.availableFrom)}` : 'Join Waitlist'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Nearby MRT */}
            {property.nearbyMRT && property.nearbyMRT.length > 0 && (
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
          </div>

          {/* Right Column: Inquiry Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-28 space-y-8">
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-[rgba(187,202,198,0.15)]">
                <h4 className="text-2xl font-['Plus_Jakarta_Sans'] font-extrabold text-[#121c2a] mb-2">
                  Book a Viewing
                </h4>
                <p className="text-[#3c4947] text-sm mb-8 font-['Manrope']">
                  Connect with us to tour the space and meet your potential housemates.
                </p>
                <div className="space-y-4">
                  <a
                    href={`https://wa.me/6580885410?text=${encodeURIComponent(`Hi! I'm interested in viewing ${property.name}.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-[#006b5f] text-white py-4 rounded-xl font-['Plus_Jakarta_Sans'] font-bold text-lg hover:bg-[#006b5f]/90 transition-all active:scale-95 shadow-lg shadow-[#006b5f]/20 flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined">chat</span>
                    WhatsApp Us
                  </a>
                  <Link
                    to="/contact"
                    className="w-full border border-[rgba(187,202,198,0.3)] text-[#121c2a] py-4 rounded-xl font-['Plus_Jakarta_Sans'] font-bold text-lg hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined">mail</span>
                    Send Inquiry
                  </Link>
                </div>

                <div className="mt-8 pt-8 border-t border-[rgba(187,202,198,0.15)] flex items-center justify-between">
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
      </div>

      {/* Room Request Dialog */}
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
                  {selectedRoom?.isAvailable ? 'Request Room' : 'Join Waitlist'}
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
                        placeholder="hello@lazybee.sg"
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
