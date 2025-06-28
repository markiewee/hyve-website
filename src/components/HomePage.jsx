import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Calendar, DollarSign, Users, Wifi, Shield, Car, Wrench, Coffee, Star } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import ApiService from '../services/api';
import heroImage from '../assets/hero_coliving_interior.jpg';
import modernSpace from '../assets/modern_coliving_space.jpg';
import sharedKitchen from '../assets/shared_kitchen.jpg';
import hyveGreenLogo from '../assets/hyve_green.png';

const HomePage = ({ searchFilters, setSearchFilters }) => {
  const [searchLocation, setSearchLocation] = useState('');
  const [searchBudget, setSearchBudget] = useState('');
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const data = await ApiService.getProperties();
        setProperties(data);
      } catch (error) {
        console.error('Error fetching properties:', error);
        // Fallback to sample data
        const { properties: sampleProperties } = await import('../data/sampleData');
        setProperties(sampleProperties);
      } finally {
        setLoading(false);
      }
    };

    fetchProperties();
  }, []);

  const handleSearch = () => {
    setSearchFilters({
      ...searchFilters,
      location: searchLocation,
      priceRange: searchBudget ? [0, parseInt(searchBudget)] : [0, 2000]
    });
  };

  const benefits = [
    { icon: Wifi, title: 'High-Speed WiFi', description: 'Reliable internet for work and entertainment' },
    { icon: Shield, title: '24/7 Security', description: 'Safe and secure living environment' },
    { icon: Car, title: 'Parking Available', description: 'Convenient parking spaces for residents' },
    { icon: Wrench, title: 'Maintenance', description: 'Quick response to all maintenance requests' },
    { icon: Coffee, title: 'Housekeeping', description: 'Regular cleaning of common areas' },
    { icon: Users, title: 'Community Events', description: 'Regular social activities and networking' }
  ];

  const featuredProperties = properties.slice(0, 3);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroImage})` }}
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
            Stylish and Convenient
            <span className="block text-teal-400">Coliving for Everyone</span>
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-gray-200 animate-fade-in-delay">
            Experience comfort and community in Singapore's premier coliving spaces with excellent connectivity
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
                  Find a Home
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
              Join Singapore's Most Vibrant Coliving Community
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Everything you need for comfortable living, all included in one convenient package
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
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
              Discover Your New Home
            </h2>
            <p className="text-xl text-gray-600">
              Beautifully designed spaces in Singapore's most desirable neighborhoods
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
              <Card key={property.id} className="overflow-hidden hover:shadow-xl transition-shadow group">
                <div className="relative h-64 overflow-hidden">
                  <img
                    src={`/${property.images[0]}`}
                    alt={property.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-teal-600 text-white">
                      {property.availableRooms} rooms available
                    </Badge>
                  </div>
                  <div className="absolute top-4 right-4">
                    <Badge variant="secondary" className="bg-white/90 text-gray-900">
                      From ${property.startingPrice}/mo
                    </Badge>
                  </div>
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
                    <span className="text-sm">{property.neighborhood}</span>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <CardDescription className="mb-4">
                    {property.description.substring(0, 120)}...
                  </CardDescription>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {property.amenities.slice(0, 3).map((amenity, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {amenity}
                      </Badge>
                    ))}
                    {property.amenities.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{property.amenities.length - 3} more
                      </Badge>
                    )}
                  </div>
                  
                  <Link to={`/property/${property.id}`}>
                    <Button className="w-full bg-teal-600 hover:bg-teal-700">
                      Explore This Home
                    </Button>
                  </Link>
                </CardContent>
              </Card>
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
                More Than Just a Place to Stay
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Join a vibrant community of like-minded individuals from around the world. 
                Our coliving spaces are designed to foster connections, creativity, and personal growth.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-teal-600 rounded-full flex items-center justify-center">
                    <Users className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-gray-700">Regular community events and networking</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-teal-600 rounded-full flex items-center justify-center">
                    <Coffee className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-gray-700">Shared spaces designed for collaboration</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-teal-600 rounded-full flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-gray-700">Flexible lease terms to fit your lifestyle</span>
                </div>
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
                src={modernSpace}
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

      {/* CTA Section */}
      <section className="py-20 bg-gray-900 text-white">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold mb-6">
            Ready to Find Your Perfect Home?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Join hundreds of residents who have found their ideal coliving space with us
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/properties">
              <Button size="lg" className="bg-teal-600 hover:bg-teal-700">
                Browse Properties
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-gray-900">
              Schedule a Tour
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;

