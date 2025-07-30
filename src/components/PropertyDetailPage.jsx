import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  MapPin, Star, Users, Calendar, Wifi, Shield, Car, Wrench, Coffee, 
  ArrowLeft, MessageCircle, Phone, Mail, ChevronLeft, ChevronRight,
  User, Globe, Briefcase, Heart
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Separator } from './ui/separator';
import ApiService from '../services/api';
import MapComponent from './MapComponent';
import { properties, rooms, occupants } from '../data/sampleData';

const PropertyDetailPage = () => {
  const { id } = useParams();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [property, setProperty] = useState(null);
  const [propertyRooms, setPropertyRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPropertyData = async () => {
      try {
        setLoading(true);
        const [propertyData, roomsData] = await Promise.all([
          ApiService.getProperty(id),
          ApiService.getPropertyRooms(id)
        ]);
        setProperty(propertyData);
        setPropertyRooms(roomsData);
      } catch (error) {
        console.error('Error fetching property data:', error);
        // Fallback to sample data
        const sampleProperty = properties.find(p => p.id === parseInt(id));
        const sampleRooms = rooms.filter(r => r.propertyId === parseInt(id));
        setProperty(sampleProperty);
        setPropertyRooms(sampleRooms);
      } finally {
        setLoading(false);
      }
    };

    fetchPropertyData();
  }, [id]);
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Loading property...</h2>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Property not found</h2>
          <Link to="/properties">
            <Button>Back to Properties</Button>
          </Link>
        </div>
      </div>
    );
  }

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % property.images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + property.images.length) % property.images.length);
  };

  const amenityIcons = {
    'WiFi': Wifi,
    'High-Speed WiFi': Wifi,
    'Wifi Included': Wifi,
    '24/7 Security': Shield,
    'Parking': Car,
    'Parking Available': Car,
    'Maintenance': Wrench,
    'Responsive Maintenance': Wrench,
    'Housekeeping': Coffee,
    'Weekly Housekeeping': Coffee,
    'Community Events': Users
  };

  const RoomCard = ({ room }) => {
    const roomOccupant = occupants.find(o => o.roomId === room.id);
    
    return (
      <Card className={`hover:shadow-lg transition-shadow cursor-pointer ${!room.isAvailable ? 'opacity-60 grayscale' : ''}`} onClick={() => setSelectedRoom(room)}>
        {/* Room Image */}
        {room.images && room.images.length > 0 && (
          <div className="relative h-48 overflow-hidden rounded-t-lg">
            <img
              src={`/${room.images[0]}`}
              alt={`${room.roomNumber} - ${room.roomType}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2 right-2">
              <Badge variant={room.isAvailable ? "default" : "secondary"} className={room.isAvailable ? "bg-green-600" : "bg-gray-600"}>
                {room.isAvailable ? "Available" : room.availableFrom ? `Available from: ${room.availableFrom}` : "Occupied"}
              </Badge>
            </div>
          </div>
        )}
        
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{room.roomNumber} - {room.roomType}</CardTitle>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>{room.sizeSqm} sqm</span>
            <span className="font-semibold text-lg text-gray-900">${room.priceMonthly}/mo</span>
          </div>
        </CardHeader>
        
        <CardContent>
          {roomOccupant && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Avatar>
                  <AvatarFallback className="bg-teal-100 text-teal-700">
                    {roomOccupant.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{roomOccupant.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {roomOccupant.age}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <span>{roomOccupant.nationality}</span>
                    <Separator orientation="vertical" className="h-3" />
                    <span>{roomOccupant.occupation}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex flex-wrap gap-2 mb-4">
            {room.amenities.map((amenity, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {amenity}
              </Badge>
            ))}
          </div>
          
          {room.isAvailable && room.availableFrom && (
            <p className="text-sm text-gray-600">
              Available from {new Date(room.availableFrom).toLocaleDateString()}
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Link to="/properties" className="inline-flex items-center space-x-2 text-teal-600 hover:text-teal-700 mb-6">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Properties</span>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Image Gallery */}
            <Card className="overflow-hidden">
              <div className="relative h-96">
                <img
                  src={`/${property.images[currentImageIndex]}`}
                  alt={property.name}
                  className="w-full h-full object-cover"
                />
                {property.images.length > 1 && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="absolute left-4 top-1/2 transform -translate-y-1/2"
                      onClick={prevImage}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="absolute right-4 top-1/2 transform -translate-y-1/2"
                      onClick={nextImage}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </>
                )}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
                  {property.images.map((_, index) => (
                    <button
                      key={index}
                      className={`w-2 h-2 rounded-full ${
                        index === currentImageIndex ? 'bg-white' : 'bg-white/50'
                      }`}
                      onClick={() => setCurrentImageIndex(index)}
                    />
                  ))}
                </div>
              </div>
            </Card>

            {/* Property Info */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-3xl mb-2">{property.name}</CardTitle>
                    <div className="flex items-center space-x-4 text-gray-600">
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-4 h-4" />
                        <span>{property.address}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span>4.8 (24 reviews)</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-teal-600">
                      From ${property.startingPrice}
                    </div>
                    <div className="text-gray-600">per month</div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <CardDescription className="text-lg mb-6">
                  {property.description}
                </CardDescription>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-teal-600">{property.totalRooms}</div>
                    <div className="text-sm text-gray-600">Total Rooms</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-teal-600">{property.availableRooms}</div>
                    <div className="text-sm text-gray-600">Available</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-teal-600">{property.propertyType}</div>
                    <div className="text-sm text-gray-600">Property Type</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-teal-600">{property.neighborhood}</div>
                    <div className="text-sm text-gray-600">Neighborhood</div>
                  </div>
                </div>

                {/* Amenities */}
                <div>
                  <h3 className="text-xl font-semibold mb-4">Amenities</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {property.amenities.map((amenity, index) => {
                      const Icon = amenityIcons[amenity] || Coffee;
                      return (
                        <div key={index} className="flex items-center space-x-2">
                          <Icon className="w-5 h-5 text-teal-600" />
                          <span>{amenity}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Rooms Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Available Rooms & Current Residents</CardTitle>
                <CardDescription>
                  Explore individual rooms and meet your potential housemates
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {propertyRooms.map((room) => (
                    <RoomCard key={room.id} room={room} />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Card */}
            <Card>
              <CardHeader>
                <CardTitle>Interested in this property?</CardTitle>
                <CardDescription>
                  Get in touch with us to schedule a viewing or ask questions
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <Button className="w-full bg-teal-600 hover:bg-teal-700">
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule a Tour
                </Button>
                
                <a href="https://wa.me/6580885410?text=I%20would%20love%20to%20join%20the%20hyve%20community" target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="w-full">
                    <MessageCircle className="w-4 h-4 mr-2" />
                    WhatsApp Us
                  </Button>
                </a>
                
                <Button variant="outline" className="w-full">
                  <Phone className="w-4 h-4 mr-2" />
                  Call Now
                </Button>
                
                <Button variant="outline" className="w-full">
                  <Mail className="w-4 h-4 mr-2" />
                  Send Email
                </Button>
              </CardContent>
            </Card>

            {/* Quick Facts */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Facts</CardTitle>
              </CardHeader>
              
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Property Type</span>
                  <span className="font-medium">{property.propertyType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Neighborhood</span>
                  <span className="font-medium">{property.neighborhood}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Rooms</span>
                  <span className="font-medium">{property.totalRooms}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Available Rooms</span>
                  <span className="font-medium text-teal-600">{property.availableRooms}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Starting Price</span>
                  <span className="font-medium">${property.startingPrice}/mo</span>
                </div>
              </CardContent>
            </Card>

            {/* Save Property */}
            <Card>
              <CardContent className="pt-6">
                <Button variant="outline" className="w-full">
                  <Heart className="w-4 h-4 mr-2" />
                  Save Property
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Location & Map Section */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Location & Neighborhood</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Map */}
            <div className="lg:col-span-2">
              <MapComponent 
                property={property}
                height="500px"
                showNearbyAmenities={true}
                className="w-full"
              />
            </div>

            {/* Location Info */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MapPin className="w-5 h-5 mr-2 text-teal-600" />
                    Address
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700">{property.address}</p>
                  <p className="text-sm text-gray-500 mt-1">{property.neighborhood}, Singapore</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Transportation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {property.nearbyMRT && property.nearbyMRT.map((mrt, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-gray-600">{mrt.split(' (')[0]}</span>
                      <span className="font-medium">{mrt.split('(')[1]?.replace(')', '') || 'Nearby'}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Walk Score</span>
                    <span className="font-medium">{property.walkScore || 85}/100</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Transit Score</span>
                    <span className="font-medium">{property.transitScore || 90}/100</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Nearby Amenities</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {property.nearbyAmenities && property.nearbyAmenities.map((amenity, index) => (
                    <div key={index} className="flex items-center">
                      <div className="w-2 h-2 bg-teal-600 rounded-full mr-3"></div>
                      <span className="text-gray-700">{amenity}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyDetailPage;

