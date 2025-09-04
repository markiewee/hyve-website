import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Filter, Users, Calendar } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { client, QUERIES, urlFor } from '../lib/sanity';
import ApiService from '../services/api';

const PropertiesPage = ({ searchFilters, setSearchFilters }) => {
  const [showFilters, setShowFilters] = useState(false);
  const [localFilters, setLocalFilters] = useState(searchFilters);
  const [properties, setProperties] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        setLoading(true);
        // Try to fetch from Sanity first with room data
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
          client.fetch(`*[_type == "neighborhood"]{name, slug, _id}`)
        ]);

        if (sanityProperties && sanityProperties.length > 0) {
          setProperties(sanityProperties);
          setNeighborhoods(sanityNeighborhoods || []);
        } else {
          // Fallback to API/sample data with rooms
          try {
            const [propertiesData, roomsData] = await Promise.all([
              ApiService.getProperties(localFilters),
              ApiService.getRooms()
            ]);
            
            // Attach rooms to properties
            const propertiesWithRooms = propertiesData.map(property => ({
              ...property,
              rooms: roomsData.filter(room => room.propertyId === property.id)
            }));
            
            setProperties(propertiesWithRooms);
          } catch (error) {
            const { properties: sampleProperties, neighborhoods: sampleNeighborhoods, rooms: sampleRooms } = await import("../data/sampleData");
            
            // Attach rooms to sample properties
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
        // Fallback to existing API/sample data with rooms
        try {
          const [propertiesData, roomsData] = await Promise.all([
            ApiService.getProperties(localFilters),
            ApiService.getRooms()
          ]);
          
          // Attach rooms to properties
          const propertiesWithRooms = propertiesData.map(property => ({
            ...property,
            rooms: roomsData.filter(room => room.propertyId === property.id)
          }));
          
          setProperties(propertiesWithRooms);
        } catch (apiError) {
          const { properties: sampleProperties, neighborhoods: sampleNeighborhoods, rooms: sampleRooms } = await import("../data/sampleData");
          
          // Attach rooms to sample properties
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
  }, [localFilters]);

  // Filter properties based on local filters and room availability
  const filteredProperties = properties.filter(property => {
    // Location filter
    if (localFilters.location && localFilters.location !== '') {
      const neighborhoodName = property.neighborhood?.name || property.neighborhood;
      if (!neighborhoodName?.toLowerCase().includes(localFilters.location.toLowerCase())) {
        return false;
      }
    }

    // Price range filter
    if (localFilters.maxBudget && localFilters.maxBudget !== '') {
      const maxBudget = parseInt(localFilters.maxBudget);
      const propertyPrice = property.startingPrice || 0;
      if (propertyPrice > maxBudget) {
        return false;
      }
    }

    // Available from date filter
    if (localFilters.availableFrom && localFilters.availableFrom !== '') {
      const requestedDate = new Date(localFilters.availableFrom);
      
      // Check if property has any rooms available on or before the requested date
      if (property.rooms && property.rooms.length > 0) {
        const hasAvailableRoom = property.rooms.some(room => {
          if (room.isAvailable) return true; // Available now
          if (room.availableFrom) {
            const roomAvailableDate = new Date(room.availableFrom);
            return roomAvailableDate <= requestedDate;
          }
          return false; // No availability date set
        });
        if (!hasAvailableRoom) return false;
      } else {
        // For properties without detailed room data, assume available if no date constraints
        if (!property.availableFrom) return true;
        const propertyAvailableDate = new Date(property.availableFrom);
        if (propertyAvailableDate > requestedDate) return false;
      }
    }

    return true;
  });

  const handleFilterChange = (key, value) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    setSearchFilters(newFilters);
  };

  const PropertyCard = ({ property }) => (
    <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 group">
      <div className="relative aspect-[3/2] overflow-hidden">
        <img
          src={
            property.images?.[0]?.image 
              ? urlFor(property.images[0].image).width(1920).height(1280).url()
              : `/${property.images?.[0] || 'stock_apart1.png'}`
          }
          alt={property.images?.[0]?.alt || property.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
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
      </div>
      
      <div>
        <CardHeader>
          <CardTitle className="text-xl">{property.name}</CardTitle>
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

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-1" />
                <span>{property.totalRooms || property.rooms?.length || '1'} rooms</span>
              </div>
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                <span>
                  {property.rooms ? 
                    `${property.rooms.filter(r => r.isAvailable).length} available now` :
                    `${property.availableRooms || 0} available`
                  }
                </span>
              </div>
            </div>
          </div>
          
          <Link to={`/property/${property.id || property.slug?.current || property._id}`}>
            <Button className="w-full bg-teal-600 hover:bg-teal-700">
              View Details
            </Button>
          </Link>
        </CardContent>
      </div>
    </Card>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4"></div>
            <div className="h-6 bg-gray-200 rounded w-3/4 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="bg-white rounded-lg p-6 shadow">
                  <div className="h-48 bg-gray-200 rounded mb-4"></div>
                  <div className="h-6 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded mb-4"></div>
                  <div className="h-10 bg-gray-200 rounded"></div>
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
            Our Properties
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Discover premium coliving spaces across Singapore's most vibrant neighborhoods
          </p>
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-white rounded-2xl p-6 shadow-lg mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <select
                  value={localFilters.location || ''}
                  onChange={(e) => handleFilterChange('location', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md appearance-none bg-white"
                >
                  <option value="">All Locations</option>
                  {neighborhoods.map((neighborhood) => (
                    <option key={neighborhood._id || neighborhood.name} value={neighborhood.name}>
                      {neighborhood.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="relative">
                <span className="absolute left-3 top-3 text-gray-400">$</span>
                <Input
                  placeholder="Max Budget"
                  value={localFilters.maxBudget || ''}
                  onChange={(e) => handleFilterChange('maxBudget', e.target.value)}
                  className="pl-8"
                />
              </div>

              <div className="relative">
                <Calendar className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <Input
                  type="date"
                  placeholder="Available From"
                  value={localFilters.availableFrom || ''}
                  onChange={(e) => handleFilterChange('availableFrom', e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                Filters
              </Button>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between mb-8">
          <div className="text-gray-600">
            {filteredProperties.length} propert{filteredProperties.length !== 1 ? 'ies' : 'y'} found
          </div>
        </div>

        {/* Properties Grid */}
        {filteredProperties.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProperties.map((property) => (
              <PropertyCard 
                key={property.id || property._id} 
                property={property} 
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg mb-4">
              No properties found matching your criteria
            </div>
            <Button 
              onClick={() => {
                setLocalFilters({});
                setSearchFilters({});
              }}
              variant="outline"
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertiesPage;