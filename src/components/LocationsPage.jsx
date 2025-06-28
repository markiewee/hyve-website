import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Train, ShoppingBag, Coffee, Star, Building } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { neighborhoods, properties } from '../data/sampleData';
import riverValleyImg from '../assets/river_valley_exterior.jpg';
import orchardImg from '../assets/orchard_building.jpg';
import tiongBahruImg from '../assets/tiong_bahru_neighborhood.jpg';
import modernCondoImg from '../assets/modern_condo_exterior.jpg';

const LocationsPage = () => {
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(null);

  const neighborhoodImages = {
    'River Valley': riverValleyImg,
    'Orchard': orchardImg,
    'Tiong Bahru': tiongBahruImg,
    'Lentor': modernCondoImg
  };

  const getPropertiesInNeighborhood = (neighborhoodName) => {
    return properties.filter(property => property.neighborhood === neighborhoodName);
  };

  const NeighborhoodCard = ({ neighborhood }) => {
    const neighborhoodProperties = getPropertiesInNeighborhood(neighborhood.name);
    const image = neighborhoodImages[neighborhood.name];

    return (
      <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 group cursor-pointer">
        <div className="relative h-64 overflow-hidden">
          <img
            src={image}
            alt={neighborhood.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
          <div className="absolute bottom-4 left-4 text-white">
            <h3 className="text-2xl font-bold mb-1">{neighborhood.name}</h3>
            <div className="flex items-center space-x-2">
              <Badge className="bg-white/20 text-white border-white/30">
                {neighborhoodProperties.length} properties
              </Badge>
              <div className="flex items-center space-x-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="text-sm">4.8</span>
              </div>
            </div>
          </div>
        </div>
        
        <CardHeader>
          <CardDescription className="text-gray-600">
            {neighborhood.description}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {/* Highlights */}
          <div className="mb-4">
            <h4 className="font-semibold text-gray-900 mb-2">Highlights</h4>
            <div className="flex flex-wrap gap-2">
              {neighborhood.highlights.map((highlight, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {highlight}
                </Badge>
              ))}
            </div>
          </div>
          
          {/* Transport */}
          <div className="mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <Train className="w-4 h-4 text-teal-600" />
              <h4 className="font-semibold text-gray-900">Transport</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {neighborhood.transport.map((transport, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {transport}
                </Badge>
              ))}
            </div>
          </div>
          
          {/* Amenities */}
          <div className="mb-6">
            <div className="flex items-center space-x-2 mb-2">
              <ShoppingBag className="w-4 h-4 text-teal-600" />
              <h4 className="font-semibold text-gray-900">Nearby Amenities</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {neighborhood.amenities.slice(0, 3).map((amenity, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {amenity}
                </Badge>
              ))}
              {neighborhood.amenities.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{neighborhood.amenities.length - 3} more
                </Badge>
              )}
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Starting from <span className="font-semibold text-teal-600">
                ${Math.min(...neighborhoodProperties.map(p => p.startingPrice))}/mo
              </span>
            </div>
            <Button 
              size="sm" 
              className="bg-teal-600 hover:bg-teal-700"
              onClick={() => setSelectedNeighborhood(neighborhood)}
            >
              Explore Area
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const NeighborhoodDetail = ({ neighborhood }) => {
    const neighborhoodProperties = getPropertiesInNeighborhood(neighborhood.name);
    const image = neighborhoodImages[neighborhood.name];

    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="relative h-96 rounded-2xl overflow-hidden">
          <img
            src={image}
            alt={neighborhood.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
          <div className="absolute bottom-8 left-8 text-white">
            <h1 className="text-5xl font-bold mb-4">{neighborhood.name}</h1>
            <p className="text-xl text-gray-200 max-w-2xl">
              {neighborhood.description}
            </p>
          </div>
          <Button
            variant="secondary"
            className="absolute top-8 left-8"
            onClick={() => setSelectedNeighborhood(null)}
          >
            ← Back to All Locations
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Properties in this area */}
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                Properties in {neighborhood.name}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {neighborhoodProperties.map((property) => (
                  <Card key={property.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="relative h-48 overflow-hidden">
                      <img
                        src={`/src/assets/${property.images[0]}`}
                        alt={property.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-4 left-4">
                        <Badge className="bg-teal-600 text-white">
                          {property.availableRooms} available
                        </Badge>
                      </div>
                      <div className="absolute top-4 right-4">
                        <Badge variant="secondary" className="bg-white/90 text-gray-900">
                          From ${property.startingPrice}/mo
                        </Badge>
                      </div>
                    </div>
                    
                    <CardHeader>
                      <CardTitle className="text-lg">{property.name}</CardTitle>
                      <CardDescription>
                        {property.description.substring(0, 100)}...
                      </CardDescription>
                    </CardHeader>
                    
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                          <Building className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">{property.totalRooms} rooms</span>
                        </div>
                        <Link to={`/property/${property.id}`}>
                          <Button size="sm" className="bg-teal-600 hover:bg-teal-700">
                            View Details
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Facts */}
            <Card>
              <CardHeader>
                <CardTitle>Area Highlights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {neighborhood.highlights.map((highlight, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-teal-600 rounded-full"></div>
                      <span className="text-sm">{highlight}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Transportation */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Train className="w-5 h-5 text-teal-600" />
                  <span>Transportation</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {neighborhood.transport.map((transport, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      <span className="text-sm">{transport}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Amenities */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Coffee className="w-5 h-5 text-teal-600" />
                  <span>Nearby Amenities</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {neighborhood.amenities.map((amenity, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                      <span className="text-sm">{amenity}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Contact */}
            <Card>
              <CardHeader>
                <CardTitle>Interested in this area?</CardTitle>
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-teal-600 hover:bg-teal-700">
                  Get Area Guide
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {selectedNeighborhood ? (
          <NeighborhoodDetail neighborhood={selectedNeighborhood} />
        ) : (
          <>
            {/* Header */}
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                Explore Singapore's Best Neighborhoods
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Discover the unique character and amenities of each area where our coliving spaces are located
              </p>
            </div>

            {/* Neighborhoods Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
              {neighborhoods.map((neighborhood) => (
                <NeighborhoodCard key={neighborhood.name} neighborhood={neighborhood} />
              ))}
            </div>

            {/* Map Section Placeholder */}
            <div className="mt-16">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl text-center">Interactive Map</CardTitle>
                  <CardDescription className="text-center">
                    Explore all our locations on an interactive map
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">Interactive map coming soon</p>
                      <p className="text-sm text-gray-500 mt-2">
                        Will feature Google Maps 3D integration with property markers
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LocationsPage;

