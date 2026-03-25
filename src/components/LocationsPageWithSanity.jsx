import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { client, QUERIES, urlFor } from '../lib/sanity';
import LocationsMapComponent from './LocationsMapComponent';
import SEO from './SEO';

const LocationsPage = () => {
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(null);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sanityNeighborhoods, sanityProperties] = await Promise.all([
          client.fetch(`
            *[_type == "neighborhood" && _id in *[_type == "property"].neighborhood._ref]{
              _id,
              name,
              slug,
              description,
              location,
              images[]{
                image,
                alt,
                caption
              },
              highlights,
              transport[],
              amenities[],
              demographics,
              priceRange,
              featured
            }
          `),
          client.fetch(QUERIES.properties)
        ]);

        if (sanityNeighborhoods && sanityNeighborhoods.length > 0) {
          setNeighborhoods(sanityNeighborhoods);
          setProperties(sanityProperties || []);
        } else {
          const { neighborhoods: sampleNeighborhoods, properties: sampleProperties } = await import('../data/sampleData');
          setNeighborhoods(sampleNeighborhoods);
          setProperties(sampleProperties);
        }
      } catch (error) {
        console.error('Error fetching data from Sanity:', error);
        const { neighborhoods: sampleNeighborhoods, properties: sampleProperties } = await import('../data/sampleData');
        setNeighborhoods(sampleNeighborhoods);
        setProperties(sampleProperties);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getPropertiesInNeighborhood = (neighborhoodName) => {
    return properties.filter(property => {
      const propNeighborhood = property.neighborhood?.name || property.neighborhood;
      return propNeighborhood === neighborhoodName;
    });
  };

  const getNeighborhoodImage = (neighborhood) => {
    if (neighborhood.images?.[0]?.image) {
      return urlFor(neighborhood.images[0].image).width(800).height(600).url();
    }
    return 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop&q=80';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] pt-20">
        <div className="flex h-[calc(100vh-80px)]">
          <div className="w-full md:w-[420px] bg-[#eff4ff] p-8 animate-pulse space-y-6">
            <div className="h-8 bg-slate-200 rounded w-2/3"></div>
            <div className="h-4 bg-slate-200 rounded w-full"></div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-xl space-y-4">
                <div className="h-6 bg-slate-200 rounded w-1/2"></div>
                <div className="aspect-[16/9] bg-slate-200 rounded-lg"></div>
                <div className="h-4 bg-slate-200 rounded w-full"></div>
              </div>
            ))}
          </div>
          <div className="hidden md:block flex-1 bg-slate-200 animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9ff] pt-20">
      <SEO
        title="Co-living Locations in Singapore"
        description="Discover Hyve co-living locations across Singapore. Find rooms near MRT stations in Thomson, Hougang, Bukit Batok and more."
        canonical="/locations"
        schema={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://www.hyve.sg" },
            { "@type": "ListItem", position: 2, name: "Locations", item: "https://www.hyve.sg/locations" }
          ]
        }}
      />
      <div className="flex flex-col md:flex-row h-auto md:h-[calc(100vh-80px)]">
        {/* Side Panel: Area Guides */}
        <aside className="w-full md:w-[420px] bg-[#eff4ff] md:h-full flex flex-col z-10 shadow-2xl overflow-y-auto scrollbar-hide">
          <div className="p-6 md:p-8">
            <header className="mb-8">
              <span className="font-['Inter'] text-xs uppercase tracking-widest text-[#006b5f] font-bold mb-2 block">
                Curated Living
              </span>
              <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold tracking-tight text-[#121c2a] leading-tight">
                Explore our Singapore Sanctuaries
              </h1>
              <p className="text-[#3c4947] mt-3 leading-relaxed font-['Manrope']">
                Modern spaces designed for community, focus, and serenity.
              </p>
            </header>

            <div className="space-y-6">
              {neighborhoods.map((neighborhood) => {
                const neighborhoodProperties = getPropertiesInNeighborhood(neighborhood.name);
                return (
                  <div
                    key={neighborhood._id || neighborhood.name}
                    className="group bg-white p-6 rounded-xl border border-[rgba(187,202,198,0.15)] hover:shadow-lg transition-all duration-300 cursor-pointer"
                    onClick={() => setSelectedNeighborhood(neighborhood)}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-[#121c2a]">
                          {neighborhood.name}
                        </h3>
                        <p className="font-['Inter'] text-sm text-[#555f6f]">
                          {neighborhoodProperties.length} propert{neighborhoodProperties.length !== 1 ? 'ies' : 'y'}
                        </p>
                      </div>
                      {neighborhood.featured && (
                        <span className="bg-[#71f8e4] text-[#00201c] px-3 py-1 rounded-full text-xs font-bold font-['Inter'] uppercase">
                          Popular
                        </span>
                      )}
                    </div>

                    <div className="aspect-[16/9] rounded-lg overflow-hidden mb-4 relative">
                      <img
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        src={getNeighborhoodImage(neighborhood)}
                        alt={neighborhood.name}
                        loading="lazy"
                      />
                    </div>

                    {/* Tags */}
                    {neighborhood.highlights && neighborhood.highlights.length > 0 && (
                      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
                        {neighborhood.highlights.slice(0, 3).map((highlight, idx) => (
                          <div key={idx} className="flex items-center gap-1 bg-[#dee9fc] px-3 py-1 rounded-full whitespace-nowrap">
                            <span className="text-xs font-['Inter']">{highlight}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="text-sm text-[#3c4947] leading-relaxed">
                      {neighborhood.description
                        ? neighborhood.description.substring(0, 120) + '...'
                        : `Discover ${neighborhood.name}, one of Singapore's most vibrant neighborhoods.`}
                    </p>

                    {/* Price range */}
                    {neighborhood.priceRange?.rentRange && (
                      <p className="mt-3 text-sm font-['Inter'] font-semibold text-[#006b5f]">
                        {neighborhood.priceRange.rentRange}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <footer className="mt-12 py-8 text-center">
              <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-slate-400">
                &copy; {new Date().getFullYear()} Hyve Living. Architectural Sanctuary.
              </p>
            </footer>
          </div>
        </aside>

        {/* Map Area */}
        <section className="flex-1 relative bg-[#e6eeff] min-h-[400px] md:min-h-0">
          <LocationsMapComponent
            properties={properties}
            neighborhoods={neighborhoods}
            height="100%"
            onPropertySelect={(property) => {
              console.log('Selected property:', property);
            }}
          />

          {/* Search overlay */}
          <div className="absolute top-6 left-6 right-6 md:right-auto md:w-[400px] z-10">
            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-[#6c7a77]">search</span>
              </div>
              <input
                className="w-full bg-white/90 backdrop-blur-md border-none rounded-2xl py-4 pl-12 pr-4 shadow-xl text-[#121c2a] focus:ring-2 focus:ring-[#006b5f] transition-all font-['Manrope']"
                placeholder="Search by district or MRT..."
                type="text"
              />
            </div>
          </div>
        </section>
      </div>

      {/* Neighborhood Detail Modal */}
      {selectedNeighborhood && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="relative">
              <img
                src={getNeighborhoodImage(selectedNeighborhood)}
                alt={selectedNeighborhood.name}
                className="w-full aspect-[3/2] object-cover rounded-t-2xl"
              />
              <button
                className="absolute top-4 right-4 bg-white/90 hover:bg-white p-2 rounded-full transition-colors"
                onClick={() => setSelectedNeighborhood(null)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
              <div className="absolute bottom-6 left-8 text-white">
                <h2 className="text-3xl font-['Plus_Jakarta_Sans'] font-bold drop-shadow-lg">{selectedNeighborhood.name}</h2>
              </div>
            </div>

            <div className="p-6 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xl font-['Plus_Jakarta_Sans'] font-bold mb-4">About the Area</h3>
                  <p className="text-[#3c4947] mb-6 font-['Manrope'] leading-relaxed">
                    {selectedNeighborhood.description}
                  </p>

                  {selectedNeighborhood.highlights && (
                    <div className="mb-6">
                      <h4 className="font-['Plus_Jakarta_Sans'] font-bold mb-2">Highlights</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedNeighborhood.highlights.map((highlight, index) => (
                          <span key={index} className="bg-[#eff4ff] text-[#121c2a] px-3 py-1 rounded-full text-sm font-['Inter']">
                            {highlight}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  {selectedNeighborhood.transport && selectedNeighborhood.transport.length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-['Plus_Jakarta_Sans'] font-bold mb-2 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#006b5f]">train</span>
                        Transportation
                      </h4>
                      {selectedNeighborhood.transport.map((transport, index) => (
                        <p key={index} className="text-sm text-[#3c4947] mb-1 font-['Manrope']">
                          <strong>{transport.type}:</strong> {transport.description}
                        </p>
                      ))}
                    </div>
                  )}

                  {selectedNeighborhood.priceRange?.rentRange && (
                    <div className="mb-6">
                      <h4 className="font-['Plus_Jakarta_Sans'] font-bold mb-1 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#006b5f]">payments</span>
                        Typical Rent
                      </h4>
                      <p className="text-lg font-['Plus_Jakarta_Sans'] font-extrabold text-[#006b5f]">
                        {selectedNeighborhood.priceRange.rentRange}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Properties in this neighborhood */}
              <div className="border-t border-slate-100 pt-6 mt-4">
                <h4 className="font-['Plus_Jakarta_Sans'] font-bold mb-4">Available Properties</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {getPropertiesInNeighborhood(selectedNeighborhood.name).map((property) => (
                    <Link
                      key={property.id || property._id}
                      to={`/property/${property.id || property.slug?.current || property._id}`}
                      className="group bg-[#eff4ff] rounded-xl overflow-hidden hover:shadow-lg transition-shadow"
                    >
                      <div className="relative aspect-[3/2]">
                        <img
                          src={
                            property.images?.[0]?.image
                              ? urlFor(property.images[0].image).width(800).height(600).url()
                              : `/${property.images?.[0] || 'stock_apart1.png'}`
                          }
                          alt={property.name}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <span className="absolute top-3 right-3 bg-[#006b5f] text-white px-3 py-1 rounded-full text-xs font-['Inter'] font-bold">
                          ${property.startingPrice}/mo
                        </span>
                      </div>
                      <div className="p-4">
                        <h5 className="font-['Plus_Jakarta_Sans'] font-bold mb-1">{property.name}</h5>
                        <p className="text-sm text-[#555f6f] font-['Manrope']">
                          {property.availableRooms} rooms available
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <Link
                  to="/properties"
                  className="flex-1 bg-[#006b5f] text-white py-3 rounded-xl font-['Plus_Jakarta_Sans'] font-bold text-center hover:opacity-90 transition-all"
                >
                  View All Properties
                </Link>
                <button
                  onClick={() => setSelectedNeighborhood(null)}
                  className="flex-1 border border-slate-200 py-3 rounded-xl font-['Plus_Jakarta_Sans'] font-bold text-center hover:bg-slate-50 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationsPage;
