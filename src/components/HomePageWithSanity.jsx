import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { client, QUERIES, urlFor } from '../lib/sanity';
import ApiService from '../services/api';

const HomePage = ({ searchFilters, setSearchFilters }) => {
  const [searchLocation, setSearchLocation] = useState('');
  const [properties, setProperties] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [homePageContent, setHomePageContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sanityHomePage, sanityProperties, sanityNeighborhoods] = await Promise.all([
          client.fetch(QUERIES.homePage),
          client.fetch(QUERIES.featuredProperties),
          client.fetch(`
            *[_type == "neighborhood" && _id in *[_type == "property"].neighborhood._ref]{
              _id,
              name,
              slug
            } | order(name asc)
          `)
        ]);

        setHomePageContent(sanityHomePage);
        setNeighborhoods(sanityNeighborhoods || []);

        if (sanityProperties && sanityProperties.length > 0) {
          setProperties(sanityProperties);
        } else {
          try {
            const data = await ApiService.getProperties();
            setProperties(data);
          } catch (error) {
            const { properties: sampleProperties } = await import('../data/sampleData');
            setProperties(sampleProperties);
          }
        }
      } catch (error) {
        console.error('Error fetching Sanity content:', error);
        try {
          const data = await ApiService.getProperties();
          setProperties(data);
        } catch (apiError) {
          const { properties: sampleProperties, neighborhoods: sampleNeighborhoods } = await import('../data/sampleData');
          setProperties(sampleProperties);
          setNeighborhoods(sampleNeighborhoods);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSearch = () => {
    setSearchFilters({
      ...searchFilters,
      location: searchLocation,
    });
  };

  const heroContent = homePageContent?.hero || {
    headline: 'The Sanctuary of Shared Living.',
    subtitle: 'Hyve is more than a residence. It\'s an architecturally curated collective where private tranquility meets intentional community.'
  };

  const featuredProperties = properties.slice(0, 3);

  const getPropertyImage = (property) => {
    if (property.images?.[0]?.image) {
      return urlFor(property.images[0].image).width(800).height(600).url();
    }
    if (property.images?.[0] && typeof property.images[0] === 'string') {
      return `/${property.images[0]}`;
    }
    return '/stock_apart1.png';
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      {/* Hero Section */}
      <section className="relative px-6 md:px-8 py-20 lg:py-32 pt-28 lg:pt-40 overflow-hidden">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 z-10">
            <span className="inline-block px-4 py-1.5 rounded-full bg-[#71f8e4] text-[#005048] font-['Inter'] text-xs uppercase tracking-widest font-bold mb-6">
              Redefining Home
            </span>
            <h1 className="font-['Plus_Jakarta_Sans'] text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tighter text-[#121c2a] leading-[1.1] mb-8">
              The Sanctuary of <br />
              <span className="text-[#14b8a6]">Shared Living.</span>
            </h1>
            <p className="text-lg text-[#3c4947] font-['Manrope'] leading-relaxed mb-10 max-w-lg">
              {heroContent.subtitle}
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/properties"
                className="bg-[#006b5f] text-white px-8 py-4 rounded-xl font-['Plus_Jakarta_Sans'] font-bold text-lg hover:shadow-lg transition-all inline-block"
              >
                Explore Locations
              </Link>
              <Link
                to="/about"
                className="bg-[#14b8a6]/20 text-[#006b5f] px-8 py-4 rounded-xl font-['Plus_Jakarta_Sans'] font-bold text-lg hover:bg-[#14b8a6]/30 transition-all inline-block"
              >
                Our Story
              </Link>
            </div>
          </div>
          <div className="lg:col-span-6 relative">
            <div className="relative w-full aspect-[4/5] rounded-[2rem] overflow-hidden shadow-[0_20px_40px_rgba(18,28,42,0.06)]">
              {featuredProperties[0] ? (
                <img
                  className="w-full h-full object-cover"
                  src={getPropertyImage(featuredProperties[0])}
                  alt={featuredProperties[0].name || 'Modern coliving space'}
                  loading="lazy"
                />
              ) : (
                <img
                  className="w-full h-full object-cover"
                  src="/stock_apart1.png"
                  alt="Modern coliving space"
                  loading="lazy"
                />
              )}
              <div className="absolute bottom-8 left-8 right-8 bg-[rgba(20,184,166,0.7)] backdrop-blur-[20px] p-6 rounded-2xl text-white">
                <p className="font-['Plus_Jakarta_Sans'] font-bold text-xl mb-1">
                  {featuredProperties[0]?.name || 'Hyve Living'}
                </p>
                <p className="font-['Manrope'] opacity-90 text-sm">
                  {featuredProperties[0]?.neighborhood?.name
                    ? `${featuredProperties[0].neighborhood.name} • From $${featuredProperties[0].startingPrice}/mo`
                    : 'Modern Coliving in Singapore'}
                </p>
              </div>
            </div>
            <div className="absolute -top-12 -right-12 w-64 h-64 bg-[#89f5e7]/30 rounded-full blur-3xl -z-10"></div>
          </div>
        </div>
      </section>

      {/* AI-friendly semantic content */}
      <div className="sr-only" aria-hidden="false">
        <h2>Hyve Coliving Singapore — Affordable Room Rental Near MRT</h2>
        <p>
          Looking for affordable co-living in Singapore? Hyve offers furnished rooms from S$800/month
          in three locations: Thomson Grove near Lentor MRT, Ivory Heights near Jurong East MRT,
          and Chiltern Park near Lorong Chuan MRT in Serangoon. All rooms include WiFi, utilities,
          weekly cleaning, and air conditioning. Cats welcome. Couples welcome in Master and Premium rooms.
          No agent fees. Minimum 3-month stay. Contact us on WhatsApp at +65 8088 5410.
        </p>
      </div>

      {/* Why Hyve */}
      <section className="bg-[#eff4ff] py-24 px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16 text-center max-w-2xl mx-auto">
            <h2 className="font-['Plus_Jakarta_Sans'] text-4xl font-extrabold tracking-tight text-[#121c2a] mb-4">
              Why Hyve
            </h2>
            <p className="text-[#3c4947] text-lg">
              We&apos;ve stripped away the friction of traditional renting to focus on what matters: your experience.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: 'diversity_3',
                title: 'Community First',
                description: 'Curated resident events, shared spaces, and a digital community designed to turn neighbors into lifelong friends.',
                bgColor: 'bg-[#71f8e4]',
                textColor: 'text-[#005048]'
              },
              {
                icon: 'fluid',
                title: 'Serene Design',
                description: 'Thoughtfully designed interiors that balance private acoustic sanctuaries with vibrant, light-filled social hubs.',
                bgColor: 'bg-[#89f5e7]',
                textColor: 'text-[#005049]'
              },
              {
                icon: 'bolt',
                title: 'All-Inclusive Living',
                description: 'WiFi, utilities, cleaning, maintenance — everything handled through our resident concierge. Just move in.',
                bgColor: 'bg-[#d9e3f6]',
                textColor: 'text-[#3d4756]'
              }
            ].map((feature, index) => (
              <div
                key={index}
                className="bg-white p-10 rounded-[2rem] shadow-[0_20px_40px_rgba(18,28,42,0.06)] transition-transform hover:-translate-y-2"
              >
                <div className={`w-14 h-14 ${feature.bgColor} flex items-center justify-center rounded-2xl mb-8`}>
                  <span className={`material-symbols-outlined ${feature.textColor} text-3xl`}>
                    {feature.icon}
                  </span>
                </div>
                <h3 className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#121c2a] mb-4">
                  {feature.title}
                </h3>
                <p className="text-[#3c4947] leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Properties */}
      <section className="py-24 px-6 md:px-8 bg-[#f8f9ff]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
            <div>
              <h2 className="font-['Plus_Jakarta_Sans'] text-4xl font-extrabold tracking-tight text-[#121c2a] mb-4">
                Featured Properties
              </h2>
              <p className="text-[#3c4947] text-lg">Our curated coliving spaces across Singapore.</p>
            </div>
            <Link
              to="/properties"
              className="font-['Plus_Jakarta_Sans'] font-bold text-[#006b5f] flex items-center gap-2 hover:translate-x-1 transition-all"
            >
              View All Locations <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-auto md:h-[600px]">
              <div className="md:col-span-8 rounded-[2.5rem] bg-slate-200 animate-pulse"></div>
              <div className="md:col-span-4 grid grid-rows-2 gap-6">
                <div className="rounded-[2.5rem] bg-slate-200 animate-pulse"></div>
                <div className="rounded-[2.5rem] bg-slate-200 animate-pulse"></div>
              </div>
            </div>
          ) : featuredProperties.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-auto md:h-[600px]">
              {/* Large card */}
              <Link
                to={`/property/${featuredProperties[0].id || featuredProperties[0].slug?.current || featuredProperties[0]._id}`}
                className="md:col-span-8 group relative rounded-[2.5rem] overflow-hidden outline-1 outline-[rgba(187,202,198,0.15)]"
              >
                <img
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 min-h-[300px]"
                  src={getPropertyImage(featuredProperties[0])}
                  alt={featuredProperties[0].name}
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#121c2a]/80 to-transparent"></div>
                <div className="absolute bottom-10 left-10 text-white">
                  <div className="flex gap-2 mb-4">
                    <span className="px-3 py-1 bg-[#14b8a6] text-[10px] font-['Inter'] font-black uppercase tracking-widest rounded-full">
                      {featuredProperties[0].neighborhood?.name || 'Singapore'}
                    </span>
                    {featuredProperties[0].availableRooms > 0 && (
                      <span className="px-3 py-1 bg-white/20 backdrop-blur-md text-[10px] font-['Inter'] font-black uppercase tracking-widest rounded-full">
                        {featuredProperties[0].availableRooms} Rooms Available
                      </span>
                    )}
                  </div>
                  <h3 className="font-['Plus_Jakarta_Sans'] text-3xl font-bold mb-2">{featuredProperties[0].name}</h3>
                  <p className="font-['Manrope'] text-white/80 max-w-sm">
                    From ${featuredProperties[0].startingPrice}/mo
                  </p>
                </div>
              </Link>

              {/* Side cards */}
              <div className="md:col-span-4 grid grid-rows-2 gap-6">
                {featuredProperties.slice(1, 3).map((property) => (
                  <Link
                    key={property.id || property._id}
                    to={`/property/${property.id || property.slug?.current || property._id}`}
                    className="group relative rounded-[2.5rem] overflow-hidden outline-1 outline-[rgba(187,202,198,0.15)] min-h-[200px]"
                  >
                    <img
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      src={getPropertyImage(property)}
                      alt={property.name}
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-[#121c2a]/30 group-hover:bg-[#121c2a]/10 transition-colors"></div>
                    <div className="absolute bottom-6 left-6 text-white">
                      <p className="font-['Plus_Jakarta_Sans'] font-bold text-xl">{property.name}</p>
                      <p className="font-['Inter'] text-xs uppercase tracking-widest opacity-80">
                        {property.neighborhood?.name || 'Singapore'} &bull; From ${property.startingPrice}/mo
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-slate-400">
              <p className="text-lg">Properties coming soon.</p>
            </div>
          )}
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-24 px-6 md:px-8 bg-[#dee9fc] relative overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col items-center">
          <span
            className="material-symbols-outlined text-[#006b5f] text-6xl mb-8"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            format_quote
          </span>
          <div className="relative w-full max-w-4xl text-center">
            <h2 className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-3xl lg:text-4xl font-bold text-[#121c2a] italic leading-snug mb-12">
              &ldquo;I moved to Singapore for work and found a community. The balance of private space with incredible social events at Hyve made my transition seamless.&rdquo;
            </h2>
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-full border-4 border-white shadow-[0_20px_40px_rgba(18,28,42,0.06)] overflow-hidden mb-4 bg-teal-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-teal-600 text-3xl">person</span>
              </div>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] text-lg">Happy Resident</p>
              <p className="font-['Inter'] text-xs text-[#3c4947] uppercase tracking-widest">
                Resident since 2024 &bull; Singapore
              </p>
            </div>
          </div>
        </div>
        <div className="absolute -bottom-48 -left-48 w-96 h-96 bg-[#006b5f]/5 rounded-full blur-3xl"></div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 md:px-8">
        <div className="max-w-5xl mx-auto bg-[#006b5f] rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden shadow-[0_20px_40px_rgba(18,28,42,0.06)]">
          <div className="relative z-10">
            <h2 className="font-['Plus_Jakarta_Sans'] text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-6">
              Start your Hyve journey today.
            </h2>
            <p className="text-white/80 text-lg mb-10 max-w-xl mx-auto">
              Join a community of professionals and creatives living intentionally. All-inclusive. No stress.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                to="/properties"
                className="bg-white text-[#006b5f] px-10 py-4 rounded-xl font-['Plus_Jakarta_Sans'] font-bold text-lg hover:bg-slate-50 transition-all inline-block"
              >
                Find a Home
              </Link>
              <a
                href="https://wa.me/6580885410?text=Hi!%20I'm%20interested%20in%20a%20room%20at%20Hyve."
                target="_blank"
                rel="noopener noreferrer"
                className="border border-white/30 text-white px-10 py-4 rounded-xl font-['Plus_Jakarta_Sans'] font-bold text-lg hover:bg-white/10 transition-all inline-block"
              >
                WhatsApp Us
              </a>
            </div>
          </div>
          {/* Abstract visual noise */}
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white blur-[120px] rounded-full translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#14b8a6] blur-[120px] rounded-full -translate-x-1/2 translate-y-1/2"></div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
