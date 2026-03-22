import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { client, QUERIES, urlFor } from '../lib/sanity';
import ApiService from '../services/api';

const PropertiesPage = ({ searchFilters, setSearchFilters }) => {
  const [localFilters, setLocalFilters] = useState(searchFilters);
  const [properties, setProperties] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        setLoading(true);
        const [sanityProperties, sanityNeighborhoods] = await Promise.all([
          client.fetch(`*[_type == "property"] | order(_createdAt desc){
            _id,
            name,
            slug,
            description,
            address,
            neighborhood->{
              name,
              slug
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
            featured,
            status,
            "rooms": *[_type == "room" && property._ref == ^._id]{
              _id,
              roomNumber,
              roomType,
              priceMonthly,
              isAvailable,
              availableFrom
            }
          }`),
          client.fetch(`*[_type == "neighborhood" && _id in *[_type == "property"].neighborhood._ref]{name, slug, _id}`)
        ]);

        if (sanityProperties && sanityProperties.length > 0) {
          setProperties(sanityProperties);
          setNeighborhoods(sanityNeighborhoods || []);
        } else {
          try {
            const [propertiesData, roomsData] = await Promise.all([
              ApiService.getProperties(),
              ApiService.getRooms()
            ]);
            const propertiesWithRooms = propertiesData.map(property => ({
              ...property,
              rooms: roomsData.filter(room => room.propertyId === property.id)
            }));
            setProperties(propertiesWithRooms);
          } catch (error) {
            const { properties: sampleProperties, neighborhoods: sampleNeighborhoods, rooms: sampleRooms } = await import("../data/sampleData");
            const propertiesWithRooms = sampleProperties.map(property => ({
              ...property,
              rooms: sampleRooms.filter(room => room.propertyId === property.id)
            }));
            setProperties(propertiesWithRooms);
            setNeighborhoods(sampleNeighborhoods);
          }
        }
      } catch (error) {
        console.error("Error fetching properties from Sanity:", error);
        try {
          const [propertiesData, roomsData] = await Promise.all([
            ApiService.getProperties(),
            ApiService.getRooms()
          ]);
          const propertiesWithRooms = propertiesData.map(property => ({
            ...property,
            rooms: roomsData.filter(room => room.propertyId === property.id)
          }));
          setProperties(propertiesWithRooms);
        } catch (apiError) {
          const { properties: sampleProperties, neighborhoods: sampleNeighborhoods, rooms: sampleRooms } = await import("../data/sampleData");
          const propertiesWithRooms = sampleProperties.map(property => ({
            ...property,
            rooms: sampleRooms.filter(room => room.propertyId === property.id)
          }));
          setProperties(propertiesWithRooms);
          setNeighborhoods(sampleNeighborhoods);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProperties();
  }, []);

  // Filter logic
  const filteredProperties = properties.filter(property => {
    if (localFilters.location && localFilters.location !== '') {
      const neighborhoodName = property.neighborhood?.name || property.neighborhood;
      if (!neighborhoodName?.toLowerCase().includes(localFilters.location.toLowerCase())) {
        return false;
      }
    }
    if (localFilters.maxBudget && localFilters.maxBudget !== '') {
      const maxBudget = parseInt(localFilters.maxBudget);
      const propertyPrice = property.startingPrice || 0;
      if (propertyPrice > maxBudget) return false;
    }
    if (localFilters.availableFrom && localFilters.availableFrom !== '') {
      const requestedDate = new Date(localFilters.availableFrom);
      if (property.rooms && property.rooms.length > 0) {
        const hasAvailableRoom = property.rooms.some(room => {
          if (room.isAvailable) return true;
          if (room.availableFrom) {
            return new Date(room.availableFrom) <= requestedDate;
          }
          return false;
        });
        if (!hasAvailableRoom) return false;
      }
    }
    return true;
  });

  const handleFilterChange = (key, value) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    if (setSearchFilters) setSearchFilters(newFilters);
  };

  const getPropertyImage = (property) => {
    if (property.images?.[0]?.image) {
      return urlFor(property.images[0].image).width(800).height(600).url();
    }
    if (property.images?.[0] && typeof property.images[0] === 'string') {
      return `/${property.images[0]}`;
    }
    return 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop&q=80';
  };

  const PropertyCard = ({ property }) => (
    <Link
      to={`/property/${property.id || property.slug?.current || property._id}`}
      className="group cursor-pointer block"
    >
      <div className="relative aspect-[4/5] rounded-[2rem] overflow-hidden mb-6 shadow-sm group-hover:shadow-xl transition-shadow duration-500">
        <img
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          src={getPropertyImage(property)}
          alt={property.images?.[0]?.alt || property.name}
          loading="lazy"
        />
        <div className="absolute top-6 left-6 flex gap-2">
          {property.availableRooms > 0 && (
            <span className="bg-white/90 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-['Inter'] font-bold uppercase tracking-widest text-[#006b5f]">
              {property.availableRooms} Available
            </span>
          )}
          {property.featured && (
            <span className="bg-[#006b5f] px-4 py-1.5 rounded-full text-[10px] font-['Inter'] font-bold uppercase tracking-widest text-white">
              Featured
            </span>
          )}
        </div>
        <div className="absolute bottom-6 left-6 right-6 p-6 bg-white/70 backdrop-blur-xl rounded-2xl transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
          <div className="flex justify-between items-center">
            <span className="font-['Plus_Jakarta_Sans'] font-bold text-teal-900">
              {property.availableRooms > 0 ? 'Rooms Available' : 'View Details'}
            </span>
            <span className="material-symbols-outlined text-teal-600">arrow_forward</span>
          </div>
        </div>
      </div>
      <div className="space-y-3 px-2">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-xl font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a]">{property.name}</h3>
            <p className="text-sm text-[#555f6f] flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">location_on</span>
              {property.neighborhood?.name || property.neighborhood || 'Singapore'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-['Plus_Jakarta_Sans'] font-extrabold text-[#006b5f]">
              ${property.startingPrice}<span className="text-xs font-normal text-[#555f6f]">/mo</span>
            </p>
          </div>
        </div>
        <div className="flex gap-3 pt-2 flex-wrap">
          {(property.amenities || []).slice(0, 3).map((amenity, index) => (
            <div key={index} className="flex items-center gap-1.5 bg-[#dee9fc]/50 px-3 py-1.5 rounded-lg">
              <span className="text-xs font-['Inter'] font-semibold text-[#3c4947]">{amenity}</span>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] pt-24">
        <div className="max-w-screen-2xl mx-auto px-6 md:px-8">
          <div className="animate-pulse space-y-8">
            <div className="h-10 bg-slate-200 rounded-xl w-1/2"></div>
            <div className="h-6 bg-slate-200 rounded-xl w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <div className="aspect-[4/5] bg-slate-200 rounded-[2rem] mb-6"></div>
                  <div className="h-6 bg-slate-200 rounded w-2/3 mb-2"></div>
                  <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9ff] pt-24">
      {/* Header + Search */}
      <header className="px-6 md:px-8 pb-8 max-w-screen-2xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-end gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-['Plus_Jakarta_Sans'] font-extrabold tracking-tight text-[#121c2a]">
              Discover your sanctuary.
            </h1>
            <p className="text-[#555f6f] font-['Manrope'] max-w-md">
              Browse our curated collection of coliving spaces designed for modern living.
            </p>
          </div>
          {/* Filter Bar */}
          <div className="w-full md:w-auto flex flex-wrap gap-3">
            <div className="bg-white rounded-xl p-2 flex items-center outline-1 outline-[rgba(187,202,198,0.15)] focus-within:outline-[#006b5f] px-4 py-3 min-w-[240px]">
              <span className="material-symbols-outlined text-[#6c7a77] mr-2">search</span>
              <input
                className="bg-transparent border-none focus:ring-0 focus:outline-none text-sm font-['Manrope'] w-full"
                placeholder="Location, neighborhood..."
                type="text"
                value={localFilters.location || ''}
                onChange={(e) => handleFilterChange('location', e.target.value)}
              />
            </div>
            <button
              onClick={() => {
                setLocalFilters({});
                if (setSearchFilters) setSearchFilters({});
              }}
              className="flex items-center gap-2 bg-[#14b8a6]/20 text-[#006b5f] px-5 py-3 rounded-xl font-['Inter'] text-sm font-semibold hover:bg-[#14b8a6]/30 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">filter_list</span>
              Clear Filters
            </button>
          </div>
        </div>
      </header>

      {/* Results count */}
      <div className="px-6 md:px-8 max-w-screen-2xl mx-auto mb-4">
        <p className="text-sm text-[#555f6f] font-['Inter']">
          {filteredProperties.length} propert{filteredProperties.length !== 1 ? 'ies' : 'y'} found
        </p>
      </div>

      {/* Properties Grid */}
      <section className="px-6 md:px-8 pb-24 max-w-screen-2xl mx-auto">
        {filteredProperties.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProperties.map((property) => (
              <PropertyCard key={property.id || property._id} property={property} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-6xl text-slate-300 mb-4 block">search_off</span>
            <p className="text-lg text-[#555f6f] mb-4">No properties found matching your criteria</p>
            <button
              onClick={() => {
                setLocalFilters({});
                if (setSearchFilters) setSearchFilters({});
              }}
              className="bg-[#006b5f] text-white px-6 py-3 rounded-xl font-['Plus_Jakarta_Sans'] font-bold hover:opacity-90 transition-all"
            >
              Clear Filters
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default PropertiesPage;
