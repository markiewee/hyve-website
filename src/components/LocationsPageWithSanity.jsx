import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Train, ShoppingBag, Coffee, Building, Users, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { client, QUERIES, urlFor } from '../lib/sanity';
import LocationsMapComponent from './LocationsMapComponent';
import riverValleyImg from '../assets/river_valley_exterior.jpg';
import orchardImg from '../assets/orchard_building.jpg';
import tiongBahruImg from '../assets/tiong_bahru_neighborhood.jpg';
import modernCondoImg from '../assets/modern_condo_exterior.jpg';

const LocationsPage = () => {
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(null);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Try to fetch from Sanity first
        const [sanityNeighborhoods, sanityProperties] = await Promise.all([
          client.fetch(`
            *[_type == "neighborhood"]{
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
          // Fallback to sample data
          const { neighborhoods: sampleNeighborhoods, properties: sampleProperties } = await import('../data/sampleData');
          setNeighborhoods(sampleNeighborhoods);
          setProperties(sampleProperties);
        }
      } catch (error) {
        console.error('Error fetching data from Sanity:', error);
        // Fallback to sample data
        const { neighborhoods: sampleNeighborhoods, properties: sampleProperties } = await import('../data/sampleData');
        setNeighborhoods(sampleNeighborhoods);
        setProperties(sampleProperties);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fallback images for neighborhoods
  const neighborhoodImages = {
    'River Valley': riverValleyImg,
    'Orchard': orchardImg,
    'Tiong Bahru': tiongBahruImg,
    'Lentor': modernCondoImg
  };

  const getPropertiesInNeighborhood = (neighborhoodName) => {
    return properties.filter(property => {
      const propNeighborhood = property.neighborhood?.name || property.neighborhood;
      return propNeighborhood === neighborhoodName;
    });
  };

  const getNeighborhoodImage = (neighborhood) => {
    if (neighborhood.images?.[0]?.image) {
      return urlFor(neighborhood.images[0].image).width(1920).height(1280).url();
    }
    return neighborhoodImages[neighborhood.name] || modernCondoImg;
  };

  const NeighborhoodCard = ({ neighborhood }) => {
    const neighborhoodProperties = getPropertiesInNeighborhood(neighborhood.name);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    
    // Get all available images for the neighborhood
    const getNeighborhoodImages = (neighborhood) => {
      const images = [];
      
      // Add Sanity images if available
      if (neighborhood.images && neighborhood.images.length > 0) {
        neighborhood.images.forEach(img => {
          images.push({
            src: urlFor(img.image).width(1920).height(1280).url(),
            alt: img.alt || neighborhood.name,
            caption: img.caption
          });
        });
      }
      
      // Add fallback image if no Sanity images or as additional image
      const fallbackImage = neighborhoodImages[neighborhood.name] || modernCondoImg;
      if (images.length === 0 || !neighborhood.images) {
        images.push({
          src: fallbackImage,
          alt: neighborhood.name,
          caption: `${neighborhood.name} neighborhood`
        });
      }
      
      return images;
    };
    
    const images = getNeighborhoodImages(neighborhood);
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
      <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 group cursor-pointer">
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
          
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
          <div className="absolute bottom-4 left-4 text-white">
            <h3 className="text-2xl font-bold mb-1">{neighborhood.name}</h3>
            <div className="flex items-center space-x-2">
              <Badge className="bg-white/20 text-white border-white/30">
                {neighborhoodProperties.length} properties
              </Badge>
            </div>
          </div>
          
          {/* Image counter */}
          {images.length > 1 && (
            <div className="absolute top-4 left-4">
              <Badge className="bg-black/50 text-white">
                {currentImageIndex + 1} / {images.length}
              </Badge>
            </div>
          )}
        </div>

        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{neighborhood.name}</span>
            {neighborhood.priceRange?.category && (
              <Badge variant="outline">
                {neighborhood.priceRange.category}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {neighborhood.description || `Discover ${neighborhood.name}, one of Singapore's most vibrant neighborhoods.`}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Highlights */}
          {neighborhood.highlights && neighborhood.highlights.length > 0 && (
            <div className="mb-4">
              <div className="flex flex-wrap gap-1">
                {neighborhood.highlights.slice(0, 3).map((highlight, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {highlight}
                  </Badge>
                ))}
                {neighborhood.highlights.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{neighborhood.highlights.length - 3} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Demographics & Vibe */}
          {neighborhood.demographics?.vibe && (
            <div className="mb-4">
              <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
                <Users className="w-4 h-4" />
                <span>Neighbourhood traits:</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {neighborhood.demographics.vibe.slice(0, 2).map((vibe, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {vibe.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Transport */}
          {neighborhood.transport && neighborhood.transport.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
                <Train className="w-4 h-4" />
                <span>Transport:</span>
              </div>
              <div className="text-sm text-gray-700">
                {neighborhood.transport[0]?.description || 'Excellent connectivity'}
              </div>
            </div>
          )}

          {/* Price Range */}
          {neighborhood.priceRange?.rentRange && (
            <div className="mb-4">
              <div className="flex items-center gap-1 text-sm text-gray-600 mb-1">
                <TrendingUp className="w-4 h-4" />
                <span>Typical rent:</span>
              </div>
              <div className="text-sm font-semibold text-teal-600">
                {neighborhood.priceRange.rentRange}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button 
              className="flex-1 bg-teal-600 hover:bg-teal-700"
              onClick={() => setSelectedNeighborhood(neighborhood)}
            >
              Explore Area
            </Button>
            <Link to="/properties" className="flex-1">
              <Button variant="outline" className="w-full">
                View Properties
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4"></div>
            <div className="h-6 bg-gray-200 rounded w-3/4 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="bg-white rounded-lg overflow-hidden shadow">
                  <div className="h-64 bg-gray-200"></div>
                  <div className="p-6">
                    <div className="h-6 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded mb-4"></div>
                    <div className="h-10 bg-gray-200 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Explore Our Locations
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            From bustling city centers to serene residential areas, find your perfect neighborhood in Singapore
          </p>
        </div>

        {/* Interactive Map */}
        <Card className="mb-12">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-6 h-6 text-teal-600" />
              Interactive Locations Map
            </CardTitle>
            <CardDescription>
              Explore all our properties and neighborhoods on the map. Click on markers to see details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LocationsMapComponent 
              properties={properties}
              neighborhoods={neighborhoods}
              height="500px"
              onPropertySelect={(property) => {
                // Optional: Navigate to property detail or show more info
                console.log('Selected property:', property);
              }}
            />
          </CardContent>
        </Card>

        {/* Neighborhoods Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {neighborhoods.map((neighborhood) => (
            <NeighborhoodCard 
              key={neighborhood._id || neighborhood.name} 
              neighborhood={neighborhood} 
            />
          ))}
        </div>

        {/* Neighborhood Detail Modal/Section */}
        {selectedNeighborhood && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="relative">
                <img
                  src={getNeighborhoodImage(selectedNeighborhood)}
                  alt={selectedNeighborhood.name}
                  className="w-full aspect-[3/2] object-cover"
                />
                <Button
                  variant="ghost"
                  className="absolute top-4 right-4 bg-white/90 hover:bg-white"
                  onClick={() => setSelectedNeighborhood(null)}
                >
                  ✕
                </Button>
                <div className="absolute bottom-4 left-6 text-white">
                  <h2 className="text-3xl font-bold">{selectedNeighborhood.name}</h2>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-xl font-semibold mb-4">About the Area</h3>
                    <p className="text-gray-600 mb-6">
                      {selectedNeighborhood.description}
                    </p>

                    {selectedNeighborhood.highlights && (
                      <div className="mb-6">
                        <h4 className="font-semibold mb-2">Highlights</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedNeighborhood.highlights.map((highlight, index) => (
                            <Badge key={index} variant="secondary">
                              {highlight}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    {selectedNeighborhood.transport && (
                      <div className="mb-6">
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <Train className="w-4 h-4" />
                          Transportation
                        </h4>
                        {selectedNeighborhood.transport.map((transport, index) => (
                          <div key={index} className="text-sm text-gray-600 mb-1">
                            <strong>{transport.type}:</strong> {transport.description}
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedNeighborhood.amenities && (
                      <div className="mb-6">
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <ShoppingBag className="w-4 h-4" />
                          Nearby Amenities
                        </h4>
                        <div className="space-y-1">
                          {selectedNeighborhood.amenities.slice(0, 5).map((amenity, index) => (
                            <div key={index} className="text-sm text-gray-600">
                              <strong>{amenity.name}</strong> - {amenity.walkingMinutes} min walk
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h4 className="font-semibold mb-4">Available Properties</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {getPropertiesInNeighborhood(selectedNeighborhood.name).map((property) => (
                      <Card key={property.id || property._id} className="overflow-hidden">
                        <div className="relative aspect-[3/2]">
                          <img
                            src={
                              property.images?.[0]?.image 
                                ? urlFor(property.images[0].image).width(1920).height(1280).url()
                                : `/${property.images?.[0] || 'stock_apart1.png'}`
                            }
                            alt={property.name}
                            className="w-full h-full object-cover"
                          />
                          <Badge className="absolute top-2 right-2 bg-teal-600 text-white">
                            ${property.startingPrice}/mo
                          </Badge>
                        </div>
                        <CardContent className="p-4">
                          <h5 className="font-semibold mb-1">{property.name}</h5>
                          <p className="text-sm text-gray-600 mb-2">
                            {property.availableRooms} rooms available
                          </p>
                          <Link to={`/property/${property.id || property.slug?.current || property._id}`}>
                            <Button size="sm" className="w-full bg-teal-600 hover:bg-teal-700">
                              View Details
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CTA Section */}
        <div className="text-center">
          <Card className="bg-teal-50 border-teal-200">
            <CardContent className="py-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Can't Find Your Ideal Location?
              </h2>
              <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
                We're always expanding to new neighborhoods. Let us know where you'd like to live and we'll keep you updated on new properties.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/properties">
                  <Button size="lg" className="bg-teal-600 hover:bg-teal-700">
                    View All Properties
                  </Button>
                </Link>
                <Button size="lg" variant="outline" className="border-teal-600 text-teal-600 hover:bg-teal-50">
                  Request New Location
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LocationsPage;