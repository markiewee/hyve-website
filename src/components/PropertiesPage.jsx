import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Filter, Grid, List, Star, Users, Calendar } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
// import { Slider } from './ui/slider';
import ApiService from '../services/api';
import { neighborhoods } from '../data/sampleData';

const PropertiesPage = ({ searchFilters, setSearchFilters }) => {
  const [viewMode, setViewMode] = useState('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [localFilters, setLocalFilters] = useState(searchFilters);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        setLoading(true);
        const data = await ApiService.getProperties(localFilters);
        setProperties(data);
      } catch (error) {
        console.error("Error fetching properties:", error);
        const { properties: sampleProperties } = await import("../data/sampleData");
        setProperties(sampleProperties);
      } finally {
        setLoading(false);
      }
    };

    fetchProperties();
  }, [localFilters]);

  // Properties are already filtered by the backend API, so we can use them directly
  const filteredProperties = properties;

  const handleFilterChange = (key, value) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    setSearchFilters(newFilters);
  };

  const PropertyCard = ({ property, isListView = false }) => (
    <Card className={`overflow-hidden hover:shadow-xl transition-all duration-300 group ${isListView ? 'flex' : ''}`}>
      <div className={`relative overflow-hidden ${isListView ? 'w-80 flex-shrink-0' : 'h-64'}`}>
        <img
          src={`/assets/${property.images[0]}`}
          alt={property.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
      
      <div className="flex-1">
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
            <span className="text-sm">{property.neighborhood}</span>
          </div>
        </CardHeader>
        
        <CardContent>
          <CardDescription className="mb-4">
            {isListView ? property.description : `${property.description.substring(0, 120)}...`}
          </CardDescription>
          
          <div className="flex flex-wrap gap-2 mb-4">
            {property.amenities.slice(0, isListView ? 6 : 3).map((amenity, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {amenity}
              </Badge>
            ))}
            {property.amenities.length > (isListView ? 6 : 3) && (
              <Badge variant="outline" className="text-xs">
                +{property.amenities.length - (isListView ? 6 : 3)} more
              </Badge>
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <Users className="w-4 h-4" />
                <span>{property.totalRooms} rooms</span>
              </div>
              <div className="flex items-center space-x-1">
                <Calendar className="w-4 h-4" />
                <span>Available now</span>
              </div>
            </div>
            
            <Link to={`/property/${property.id}`}>
              <Button className="bg-teal-600 hover:bg-teal-700">
                View Details
              </Button>
            </Link>
          </div>
        </CardContent>
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="py-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Find Your Perfect Coliving Space</h1>
          <p className="text-xl text-gray-600">
            Discover {properties.length} premium coliving properties across Singapore
          </p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <select
                value={localFilters.location}
                onChange={(e) => handleFilterChange("location", e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md bg-white appearance-none"
              >
                <option value="">All Locations</option>
                <option value="Lentor">Lentor</option>
                <option value="Orchard">Orchard</option>
                <option value="River Valley">River Valley</option>
                <option value="Tiong Bahru">Tiong Bahru</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-4">
              <select 
                value={localFilters.roomType} 
                onChange={(e) => handleFilterChange("roomType", e.target.value)}
                className="w-48 px-3 py-2 border border-gray-300 rounded-md bg-white"
              >
                <option value="">All Types</option>
                <option value="apartment">Apartment</option>
                <option value="penthouse">Penthouse</option>
                <option value="condominium">Condominium</option>
                <option value="heritage">Heritage Building</option>
              </select>
              
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-2"
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
              </Button>
              
              <div className="flex items-center space-x-2 border rounded-lg p-1">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
          
          {/* Advanced Filters */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price Range: ${localFilters.priceRange[0]} - ${localFilters.priceRange[1]}
                  </label>
                  <div className="flex items-center space-x-4">
                    <input
                      type="range"
                      min="500"
                      max="2000"
                      step="50"
                      value={localFilters.priceRange[0]}
                      onChange={(e) => handleFilterChange("priceRange", [parseInt(e.target.value), localFilters.priceRange[1]])}
                      className="flex-1"
                    />
                    <input
                      type="range"
                      min="500"
                      max="2000"
                      step="50"
                      value={localFilters.priceRange[1]}
                      onChange={(e) => handleFilterChange("priceRange", [localFilters.priceRange[0], parseInt(e.target.value)])}
                      className="flex-1"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Neighborhood
                  </label>
                  <select 
                    value={localFilters.neighborhood} 
                    onChange={(e) => handleFilterChange("neighborhood", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                  >
                    <option value="">All Neighborhoods</option>
                    {neighborhoods.map((neighborhood) => (
                      <option key={neighborhood.name} value={neighborhood.name}>
                        {neighborhood.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Available From
                  </label>
                  <Input
                    type="date"
                    value={localFilters.availableFrom}
                    onChange={(e) => handleFilterChange("availableFrom", e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-gray-600">
            Showing {filteredProperties.length} of {properties.length} properties
          </p>
          
          <select className="w-48 px-3 py-2 border border-gray-300 rounded-md bg-white" defaultValue="recommended">
            <option value="recommended">Recommended</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="newest">Newest First</option>
            <option value="rating">Highest Rated</option>
          </select>
        </div>

        {/* Properties Grid/List */}
        {loading ? (
          <div className="text-center py-12">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Loading properties...</h3>
            <p className="text-gray-600">Please wait while we fetch the latest listings.</p>
          </div>
        ) : filteredProperties.length > 0 ? (
          <div className={`${
            viewMode === "grid" 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" 
              : "space-y-6"
          } pb-12`}>
            {filteredProperties.map((property) => (
              <PropertyCard 
                key={property.id} 
                property={property} 
                isListView={viewMode === "list"} 
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No properties found</h3>
            <p className="text-gray-600 mb-6">
              Try adjusting your search criteria or browse all available properties
            </p>
            <Button 
              onClick={() => setLocalFilters({ location: "", priceRange: [0, 2000], availableFrom: "", roomType: "" })}
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

