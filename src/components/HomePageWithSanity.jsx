import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Calendar, DollarSign, Users, Wifi, Shield, Car, Wrench, Coffee, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { client, QUERIES, urlFor } from '../lib/sanity';
import ApiService from '../services/api';
import heroImage from '../assets/hero_coliving_interior.jpg';
import modernSpace from '../assets/modern_coliving_space.jpg';
import sharedKitchen from '../assets/shared_kitchen.jpg';
import hyveGreenLogo from '../assets/hyve_green.png';

const HomePage = ({ searchFilters, setSearchFilters }) => {
  const [searchLocation, setSearchLocation] = useState('');
  const [searchBudget, setSearchBudget] = useState('');
  const [properties, setProperties] = useState([]);
  const [homePageContent, setHomePageContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Try to fetch content from Sanity
        const [sanityHomePage, sanityProperties] = await Promise.all([
          client.fetch(QUERIES.homePage),
          client.fetch(QUERIES.featuredProperties)
        ]);
        
        setHomePageContent(sanityHomePage);
        
        // Use Sanity properties if available, otherwise fall back to API/sample data
        if (sanityProperties && sanityProperties.length > 0) {
          setProperties(sanityProperties);
        } else {
          // Fallback to existing API/sample data
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
        // Fallback to existing behavior
        try {
          const data = await ApiService.getProperties();
          setProperties(data);
        } catch (apiError) {
          const { properties: sampleProperties } = await import('../data/sampleData');
          setProperties(sampleProperties);
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
      priceRange: searchBudget ? [0, parseInt(searchBudget)] : [0, 2000]
    });
  };

  // Default benefits (fallback if no Sanity content)
  const defaultBenefits = [
    { icon: Wifi, title: 'High-Speed WiFi', description: 'Reliable internet for work and entertainment' },
    { icon: Shield, title: '24/7 Security', description: 'Safe and secure living environment' },
    { icon: Car, title: 'Parking Available', description: 'Convenient parking spaces for residents' },
    { icon: Wrench, title: 'Maintenance', description: 'Quick response to all maintenance requests' },
    { icon: Coffee, title: 'Housekeeping', description: 'Regular cleaning of common areas' },
    { icon: Users, title: 'Community Events', description: 'Regular social activities and networking' }
  ];

  // Use Sanity content or fallback to defaults
  const heroContent = homePageContent?.hero || {
    headline: 'Stylish and Convenient Coliving for Everyone',
    subtitle: 'Experience comfort and community in Singapore\'s premier coliving spaces with excellent connectivity'
  };

  const benefitsContent = homePageContent?.benefits || {
    title: 'Join Singapore\'s Most Vibrant Coliving Community',
    subtitle: 'Everything you need for comfortable living, all included in one convenient package',
    benefitsList: defaultBenefits
  };

  const featuredPropertiesContent = homePageContent?.featuredProperties || {
    title: 'Discover Your New Home',
    subtitle: 'Beautifully designed spaces in Singapore\'s most desirable neighborhoods'
  };

  const communityContent = homePageContent?.community || {
    title: 'More Than Just a Place to Stay',
    description: 'Join a vibrant community of like-minded individuals from around the world. Our coliving spaces are designed to foster connections, creativity, and personal growth.',
    features: [
      { feature: 'Regular community events and networking' },
      { feature: 'Shared spaces designed for collaboration' },
      { feature: 'Flexible lease terms to fit your lifestyle' }
    ]
  };

  const ctaContent = homePageContent?.cta || {
    title: 'Ready to Find Your Perfect Home?',
    subtitle: 'Join hundreds of residents who have found their ideal coliving space with us',
    primaryButton: { text: 'Browse Properties', link: '/properties' },
    secondaryButton: { text: 'Schedule a Tour' }
  };

  const featuredProperties = properties.slice(0, 3);

  // Property card component with carousel
  const PropertyCard = ({ property }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    
    // Get all available images for this property
    const getPropertyImages = (property) => {
      const images = [];
      
      // Add Sanity images if available
      if (property.images && property.images.length > 0) {
        property.images.forEach(img => {
          if (img.image) {
            images.push({
              src: urlFor(img.image).width(1920).height(1280).url(),
              alt: img.alt || property.name
            });
          }
        });
      }
      
      // Add fallback images from property.images array (for sample data)
      if (property.images && property.images.length > 0 && typeof property.images[0] === 'string') {
        property.images.forEach(imgPath => {
          images.push({
            src: `/${imgPath}`,
            alt: property.name
          });
        });
      }
      
      // Fallback if no images
      if (images.length === 0) {
        images.push({
          src: '/stock_apart1.png',
          alt: property.name
        });
      }
      
      return images;
    };
    
    const images = getPropertyImages(property);
    const currentImage = images[currentImageIndex] || images[0];
    
    const nextImage = () => {
      setCurrentImageIndex((prev) => 
        prev === images.length - 1 ? 0 : prev + 1
      );
    };

    const prevImage = () => {
      setCurrentImageIndex((prev) => 
        prev === 0 ? images.length - 1 : prev - 1
      );
    };

    return (
      <Card className="overflow-hidden hover:shadow-xl transition-shadow group">
        <div className="relative aspect-[3/2] overflow-hidden">
          <img
            src={currentImage.src}
            alt={currentImage.alt}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          
          {/* Carousel Controls - only show if multiple images */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  prevImage();
                }}
                className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  nextImage();
                }}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              
              {/* Image indicators */}
              <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 flex space-x-1.5 z-10">
                {images.map((_, index) => (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentImageIndex(index);
                    }}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentImageIndex ? 'bg-white' : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
          
          <div className="absolute top-4 left-4">
            <Badge className="bg-teal-600 text-white">
              {property.availableRooms || '1'} rooms available
            </Badge>
          </div>
          <div className="absolute top-4 right-4">
            <Badge variant="secondary" className="bg-white/90 text-gray-900">
              From ${property.startingPrice}/mo
            </Badge>
          </div>
          
          {/* Image counter */}
          {images.length > 1 && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
              <Badge className="bg-black/50 text-white">
                {currentImageIndex + 1} / {images.length}
              </Badge>
            </div>
          )}
        </div>
        
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">{property.name}</CardTitle>
            <div className="flex items-center space-x-1">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="text-sm text-gray-600">4.8</span>
            </div>
          </div>
          <div className="flex items-center text-gray-600">
            <MapPin className="w-4 h-4 mr-1" />
            <span className="text-sm">
              {property.neighborhood?.name || property.neighborhood}
            </span>
          </div>
        </CardHeader>
        
        <CardContent>
          <CardDescription className="mb-4">
            {property.description?.substring(0, 120) || 'Beautiful coliving space'}...
          </CardDescription>
          
          <div className="flex flex-wrap gap-2 mb-4">
            {(property.amenities || []).slice(0, 3).map((amenity, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {amenity}
              </Badge>
            ))}
            {(property.amenities || []).length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{property.amenities.length - 3} more
              </Badge>
            )}
          </div>
          
          <Link to={`/property/${property.id || property.slug?.current || property._id}`}>
            <Button className="w-full bg-teal-600 hover:bg-teal-700">
              Explore This Home
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ 
            backgroundImage: homePageContent?.hero?.backgroundImage 
              ? `url(${urlFor(homePageContent.hero.backgroundImage).width(1920).height(1080).url()})`
              : `url(${heroImage})`
          }}
        >
          <div className="absolute inset-0 bg-black/40"></div>
        </div>
        
        <div className="relative z-10 text-center text-white max-w-4xl mx-auto px-4">
          {/* Hyve Logo */}
          <div className="mb-8 animate-fade-in">
            <img 
              src={hyveGreenLogo} 
              alt="Hyve Logo" 
              className="w-60 h-60 mx-auto mb-4"
            />
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 animate-fade-in">
            {heroContent.headline.split(' ').slice(0, 3).join(' ')}
            <span className="block text-teal-400">
              {heroContent.headline.split(' ').slice(3).join(' ')}
            </span>
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-gray-200 animate-fade-in-delay">
            {heroContent.subtitle}
          </p>
          
          {/* Search Bar */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 max-w-2xl mx-auto animate-slide-up">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <select
                  value={searchLocation}
                  onChange={(e) => setSearchLocation(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-gray-900 bg-white appearance-none"
                >
                  <option value="">All Locations</option>
                  <option value="Lentor">Lentor</option>
                  <option value="Orchard">Orchard</option>
                  <option value="River Valley">River Valley</option>
                  <option value="Tiong Bahru">Tiong Bahru</option>
                </select>
              </div>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Max Budget"
                  value={searchBudget}
                  onChange={(e) => setSearchBudget(e.target.value)}
                  className="pl-10 text-gray-900"
                />
              </div>
              <Link to="/properties">
                <Button 
                  onClick={handleSearch}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                >
                  <Search className="w-4 h-4 mr-2" />
                  {heroContent.ctaButton?.text || 'Find a Home'}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              {benefitsContent.title}
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {benefitsContent.subtitle}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefitsContent.benefitsList.map((benefit, index) => {
              const Icon = benefit.icon || Users; // Default icon if none provided
              return (
                <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Icon className="w-8 h-8 text-teal-600" />
                    </div>
                    <CardTitle className="text-xl">{benefit.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-gray-600">
                      {benefit.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Featured Properties */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              {featuredPropertiesContent.title}
            </h2>
            <p className="text-xl text-gray-600">
              {featuredPropertiesContent.subtitle}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {loading ? (
              // Loading skeleton
              Array.from({ length: 3 }).map((_, index) => (
                <Card key={index} className="overflow-hidden">
                  <div className="h-64 bg-gray-200 animate-pulse"></div>
                  <CardHeader>
                    <div className="h-6 bg-gray-200 animate-pulse rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 animate-pulse rounded w-3/4"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-4 bg-gray-200 animate-pulse rounded mb-4"></div>
                    <div className="flex gap-2 mb-4">
                      <div className="h-6 bg-gray-200 animate-pulse rounded w-16"></div>
                      <div className="h-6 bg-gray-200 animate-pulse rounded w-20"></div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              featuredProperties.map((property) => (
                <PropertyCard 
                  key={property.id || property._id} 
                  property={property} 
                />
              ))
            )}
          </div>
          
          <div className="text-center mt-12">
            <Link to="/properties">
              <Button variant="outline" size="lg" className="border-teal-600 text-teal-600 hover:bg-teal-50">
                View All Properties
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Community Section */}
      <section className="py-20 bg-teal-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">
                {communityContent.title}
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                {communityContent.description}
              </p>
              
              <div className="space-y-4">
                {communityContent.features.map((feature, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-teal-600 rounded-full flex items-center justify-center">
                      <Users className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-gray-700">
                      {feature.feature || feature.description}
                    </span>
                  </div>
                ))}
              </div>
              
              <div className="mt-8">
                <Link to="/faqs">
                  <Button size="lg" className="bg-teal-600 hover:bg-teal-700">
                    Learn More About Our Community
                  </Button>
                </Link>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <img
                src={
                  communityContent.image 
                    ? urlFor(communityContent.image).width(1920).height(1280).url()
                    : modernSpace
                }
                alt="Modern coliving space"
                className="rounded-lg shadow-lg"
              />
              <img
                src={sharedKitchen}
                alt="Shared kitchen"
                className="rounded-lg shadow-lg mt-8"
              />
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default HomePage;