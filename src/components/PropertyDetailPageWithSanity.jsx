import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  MapPin, Star, Users, Calendar, Wifi, Shield, Car, Wrench, Coffee, 
  ArrowLeft, MessageCircle, Mail, ChevronLeft, ChevronRight,
  User, Globe, Briefcase, Heart, Home, Utensils, Dumbbell, 
  ShowerHead, AirVent, Tv, Bed, Bath, Send, CheckCircle
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Separator } from './ui/separator';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { client, QUERIES, urlFor } from '../lib/sanity';
import ApiService from '../services/api';
import PropertyMapComponent from './PropertyMapComponent';

const PropertyDetailPage = () => {
  const { id } = useParams();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [property, setProperty] = useState(null);
  const [propertyRooms, setPropertyRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [requestFormData, setRequestFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [showRoomDetailsDialog, setShowRoomDetailsDialog] = useState(false);

  useEffect(() => {
    const fetchPropertyData = async () => {
      try {
        setLoading(true);
        
        // First try to fetch from Sanity
        let sanityProperty = null;
        let sanityRooms = [];
        
        try {
          // Try to find by slug first, then by _id
          sanityProperty = await client.fetch(`
            *[_type == "property" && (slug.current == $id || _id == $id)][0]{
              _id,
              name,
              slug,
              description,
              address,
              neighborhood->{
                name,
                slug,
                description,
                highlights,
                transport,
                amenities
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
              status,
              featured
            }
          `, { id });

          if (sanityProperty) {
            // Fetch rooms for this property
            sanityRooms = await client.fetch(QUERIES.roomsByProperty, { 
              propertyId: sanityProperty._id 
            });
          }
        } catch (sanityError) {
          console.log('Sanity fetch failed, trying API/sample data:', sanityError);
        }

        if (sanityProperty) {
          setProperty(sanityProperty);
          setPropertyRooms(sanityRooms);
        } else {
          // Fallback to API or sample data
          try {
            const [propertyData, roomsData] = await Promise.all([
              ApiService.getProperty(id),
              ApiService.getPropertyRooms(id)
            ]);
            setProperty(propertyData);
            setPropertyRooms(roomsData);
          } catch (error) {
            console.error('API failed, using sample data:', error);
            // Final fallback to sample data
            const { properties, rooms } = await import('../data/sampleData');
            const sampleProperty = properties.find(p => 
              p.id === parseInt(id) || p.id === id || p.slug === id
            );
            const sampleRooms = rooms.filter(r => 
              r.propertyId === parseInt(id) || r.propertyId === id
            );
            setProperty(sampleProperty);
            setPropertyRooms(sampleRooms);
          }
        }
      } catch (error) {
        console.error('Error fetching property data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPropertyData();
  }, [id]);

  const nextImage = () => {
    if (property?.images?.length > 0) {
      setCurrentImageIndex((prev) => 
        prev === property.images.length - 1 ? 0 : prev + 1
      );
    }
  };

  const prevImage = () => {
    if (property?.images?.length > 0) {
      setCurrentImageIndex((prev) => 
        prev === 0 ? property.images.length - 1 : prev - 1
      );
    }
  };

  const getCurrentImageSrc = () => {
    if (!property?.images?.length) return '/stock_apart1.png';
    
    const currentImage = property.images[currentImageIndex];
    if (currentImage?.image) {
      // Sanity image
      return urlFor(currentImage.image).width(1920).height(1280).url();
    }
    // Sample data image
    return `/${currentImage}`;
  };

  const getCurrentImageAlt = () => {
    if (!property?.images?.length) return property?.name || 'Property image';
    
    const currentImage = property.images[currentImageIndex];
    if (currentImage?.alt) {
      return currentImage.alt;
    }
    return property?.name || 'Property image';
  };

  const handleRoomRequest = async (room) => {
    setSelectedRoom(room);
    setShowRequestDialog(true);
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    setRequestLoading(true);

    try {
      const response = await fetch('/api/send-room-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          propertyName: property.name,
          roomNumber: selectedRoom.roomNumber,
          userName: requestFormData.name,
          userEmail: requestFormData.email,
          userPhone: requestFormData.phone,
          message: requestFormData.message,
          propertyId: property._id || property.id
        }),
      });

      if (response.ok) {
        setRequestSubmitted(true);
        setTimeout(() => {
          setShowRequestDialog(false);
          setRequestSubmitted(false);
          setRequestFormData({ name: '', email: '', phone: '', message: '' });
        }, 3000);
      } else {
        alert('Failed to send request. Please try again.');
      }
    } catch (error) {
      console.error('Error sending request:', error);
      alert('Failed to send request. Please try again.');
    } finally {
      setRequestLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setRequestFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4"></div>
            <div className="h-96 bg-gray-200 rounded mb-8"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="h-6 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
              <div className="space-y-4">
                <div className="h-32 bg-gray-200 rounded"></div>
                <div className="h-48 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="mb-8">
            <Link 
              to="/properties" 
              className="inline-flex items-center text-teal-600 hover:text-teal-700 mb-6 font-medium"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Properties
            </Link>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Property Not Found</h1>
          <p className="text-lg text-gray-600 mb-8">
            Sorry, we couldn't find the property you're looking for.
          </p>
          <Link to="/properties">
            <Button className="bg-teal-600 hover:bg-teal-700">
              View All Properties
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const neighborhoodName = property.neighborhood?.name || property.neighborhood;

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <div className="mb-8">
          <Link 
            to="/properties" 
            className="inline-flex items-center text-teal-600 hover:text-teal-700 mb-6 font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Properties
          </Link>
        </div>

        {/* Image Gallery */}
        <div className="relative aspect-[3/2] rounded-2xl overflow-hidden mb-8 group">
          <img
            src={getCurrentImageSrc()}
            alt={getCurrentImageAlt()}
            className="w-full h-full object-cover"
          />
          
          {property.images && property.images.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
              
              {/* Image indicators */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
                {property.images.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`w-3 h-3 rounded-full transition-colors ${
                      index === currentImageIndex ? 'bg-white' : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            </>
          )}

          {/* Property Status */}
          <div className="absolute top-4 left-4">
            <Badge className="bg-teal-600 text-white">
              {propertyRooms?.filter(room => room.isAvailable)?.length || '0'} available
            </Badge>
          </div>
          
          {property.featured && (
            <div className="absolute top-4 right-4">
              <Badge className="bg-yellow-500 text-white">
                <Star className="w-3 h-3 mr-1" />
                Featured
              </Badge>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Property Header */}
            <div>
              <div className="mb-4">
                <h1 className="text-4xl font-bold text-gray-900">{property.name}</h1>
              </div>
              
              <div className="flex items-center text-gray-600 mb-4">
                <MapPin className="w-5 h-5 mr-2" />
                <span className="text-lg">{property.address}</span>
              </div>
              
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-1" />
                  <span>{propertyRooms?.length || property.totalRooms || '0'} rooms</span>
                </div>
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-1" />
                  <span>{propertyRooms?.filter(room => room.isAvailable)?.length || '0'} available</span>
                </div>
              </div>
            </div>

            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle>About this Property</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 leading-relaxed">
                  {property.description || `Experience modern coliving at ${property.name}. Located in the heart of ${neighborhoodName}, this property offers everything you need for comfortable urban living.`}
                </p>
              </CardContent>
            </Card>

            {/* Amenities */}
            {property.amenities && property.amenities.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Amenities</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {property.amenities.map((amenity, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
                          <Wifi className="w-4 h-4 text-teal-600" />
                        </div>
                        <span className="text-gray-700">{amenity}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Available Rooms */}
            {propertyRooms && propertyRooms.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Available Rooms</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {propertyRooms.map((room) => (
                      <Card key={room._id || room.id} className={`border hover:shadow-md transition-shadow overflow-hidden ${!room.isAvailable ? 'opacity-50 grayscale' : ''}`}>
                        {/* Room Image */}
                        <div className="relative aspect-[3/2] overflow-hidden">
                          <img
                            src={
                              room.images?.[0]?.image 
                                ? urlFor(room.images[0].image).width(1920).height(1280).url()
                                : room.images?.[0] 
                                ? `/${room.images[0]}`
                                : '/stock_apart1.png'
                            }
                            alt={room.images?.[0]?.alt || `Room ${room.roomNumber}`}
                            className="w-full h-full object-cover"
                          />
                          
                          {/* Room Status Badge */}
                          <div className="absolute top-3 right-3">
                            <Badge variant={room.isAvailable ? 'default' : 'secondary'} className="bg-white/90 text-gray-900">
                              {room.isAvailable ? 'Available' : 'Occupied'}
                            </Badge>
                          </div>
                          
                          {/* Price Badge */}
                          <div className="absolute top-3 left-3">
                            <Badge className="bg-teal-600 text-white">
                              ${room.priceMonthly}/month
                            </Badge>
                          </div>
                        </div>
                        
                        <CardContent className="p-4">
                          <div className="mb-3">
                            <h4 className="font-semibold text-lg mb-1">{room.roomName || room.roomNumber} @ {property.name}</h4>
                            <p className="text-sm text-gray-600">{room.roomType}</p>
                          </div>
                          
                          {/* Room Details */}
                          <div className="space-y-2 mb-4">
                            {room.sizeSqm && (
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">Size:</span>
                                <span className="font-medium">{room.sizeSqm} sqm</span>
                              </div>
                            )}
                            {room.floor && (
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">Floor:</span>
                                <span className="font-medium">{room.floor}</span>
                              </div>
                            )}
                            {room.facing && (
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">Facing:</span>
                                <span className="font-medium">{room.facing}</span>
                              </div>
                            )}
                            {room.window && (
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">Window:</span>
                                <span className="font-medium">{room.window ? 'Yes' : 'No'}</span>
                              </div>
                            )}
                            {(room.bathType || room.bathroom) && (
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">Bathroom:</span>
                                <span className="font-medium">{room.bathType || room.bathroom || 'Shared'}</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Room Amenities */}
                          {room.amenities && room.amenities.length > 0 && (
                            <div className="mb-4">
                              <p className="text-sm font-medium text-gray-700 mb-2">Amenities:</p>
                              <div className="flex flex-wrap gap-1">
                                {room.amenities.slice(0, 3).map((amenity, index) => (
                                  <Badge key={index} variant="outline" className="text-xs">
                                    {amenity}
                                  </Badge>
                                ))}
                                {room.amenities.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{room.amenities.length - 3} more
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}
                          
                          <div className="space-y-2">
                            {room.isAvailable ? (
                              <Button 
                                size="sm" 
                                className="w-full bg-teal-600 hover:bg-teal-700"
                                onClick={() => {
                                  setSelectedRoom(room);
                                  setShowRoomDetailsDialog(true);
                                }}
                              >
                                View Details
                              </Button>
                            ) : (
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="w-full"
                                onClick={() => handleRoomRequest(room)}
                              >
                                Request This Room
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Neighborhood Info */}
            {property.neighborhood && typeof property.neighborhood === 'object' && (
              <Card>
                <CardHeader>
                  <CardTitle>About {property.neighborhood.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">
                    {property.neighborhood.description}
                  </p>
                  {property.neighborhood.highlights && (
                    <div className="flex flex-wrap gap-2">
                      {property.neighborhood.highlights.map((highlight, index) => (
                        <Badge key={index} variant="outline">
                          {highlight}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Property Location Map */}
            {(property.location?.latitude || property.latitude) && (property.location?.longitude || property.longitude) && (
              <Card>
                <CardHeader>
                  <CardTitle>Property Location</CardTitle>
                  <CardDescription>
                    View the exact location of this property
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PropertyMapComponent 
                    property={property}
                    height="400px"
                    showFilters={false}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Pricing Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">From ${property.startingPrice}</CardTitle>
                <CardDescription>per month</CardDescription>
              </CardHeader>
              <CardContent>
                <a 
                  href={`https://wa.me/6580885410?text=Hi! I'm interested in ${property.name} starting from $${property.startingPrice}/month. Could you please provide more information about availability and viewing arrangements? Thank you!`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full"
                >
                  <Button className="w-full bg-teal-600 hover:bg-teal-700" size="lg">
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Inquire Now
                  </Button>
                </a>
              </CardContent>
            </Card>

            {/* Property Amenities */}
            <Card>
              <CardHeader>
                <CardTitle>Property Amenities</CardTitle>
              </CardHeader>
              <CardContent>
                {property.amenities && property.amenities.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3">
                    {property.amenities.map((amenity, index) => {
                      // Map amenities to icons
                      const getAmenityIcon = (amenityName) => {
                        const name = amenityName.toLowerCase();
                        if (name.includes('wifi') || name.includes('internet')) return Wifi;
                        if (name.includes('kitchen') || name.includes('cooking')) return Utensils;
                        if (name.includes('gym') || name.includes('fitness')) return Dumbbell;
                        if (name.includes('shower') || name.includes('bathroom')) return ShowerHead;
                        if (name.includes('ac') || name.includes('air con') || name.includes('cooling')) return AirVent;
                        if (name.includes('tv') || name.includes('entertainment')) return Tv;
                        if (name.includes('bed') || name.includes('furnished')) return Bed;
                        if (name.includes('laundry') || name.includes('washing')) return Bath;
                        if (name.includes('parking') || name.includes('car')) return Car;
                        if (name.includes('security') || name.includes('safe')) return Shield;
                        if (name.includes('coffee') || name.includes('cafe')) return Coffee;
                        if (name.includes('work') || name.includes('office')) return Briefcase;
                        return Home; // Default icon
                      };
                      
                      const IconComponent = getAmenityIcon(amenity);
                      
                      return (
                        <div key={index} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                          <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
                            <IconComponent className="w-4 h-4 text-teal-600" />
                          </div>
                          <span className="text-gray-700 font-medium">{amenity}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {/* Default amenities if none provided */}
                    <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
                        <Wifi className="w-4 h-4 text-teal-600" />
                      </div>
                      <span className="text-gray-700 font-medium">High-Speed WiFi</span>
                    </div>
                    <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
                        <Utensils className="w-4 h-4 text-teal-600" />
                      </div>
                      <span className="text-gray-700 font-medium">Shared Kitchen</span>
                    </div>
                    <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
                        <AirVent className="w-4 h-4 text-teal-600" />
                      </div>
                      <span className="text-gray-700 font-medium">Air Conditioning</span>
                    </div>
                    <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
                        <Shield className="w-4 h-4 text-teal-600" />
                      </div>
                      <span className="text-gray-700 font-medium">24/7 Security</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </div>

        {/* Room Request Dialog */}
        <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Request {selectedRoom?.roomName || selectedRoom?.roomNumber} @ {property?.name}</DialogTitle>
              <DialogDescription>
                This room is currently occupied, but we'll notify you when it becomes available or if similar rooms open up.
              </DialogDescription>
            </DialogHeader>
            
            {requestSubmitted ? (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Request Sent!</h3>
                <p className="text-gray-600">
                  We'll contact you as soon as this room or similar rooms become available.
                </p>
              </div>
            ) : (
              <form onSubmit={handleRequestSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <Input
                    required
                    value={requestFormData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Your full name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <Input
                    type="email"
                    required
                    value={requestFormData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="your.email@example.com"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <Input
                    value={requestFormData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="+65 1234 5678"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message
                  </label>
                  <Textarea
                    rows={4}
                    value={requestFormData.message}
                    onChange={(e) => handleInputChange('message', e.target.value)}
                    placeholder="Tell us about your preferred move-in date, specific requirements, or any questions..."
                  />
                </div>
                
                <div className="flex space-x-3">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setShowRequestDialog(false)}
                    disabled={requestLoading}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 bg-teal-600 hover:bg-teal-700"
                    disabled={requestLoading}
                  >
                    {requestLoading ? (
                      <div className="flex items-center">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Sending...
                      </div>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send Request
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Room Details Dialog */}
        <Dialog open={showRoomDetailsDialog} onOpenChange={setShowRoomDetailsDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedRoom?.roomName || selectedRoom?.roomNumber} @ {property?.name}</DialogTitle>
              <DialogDescription>
                {property?.name} - {selectedRoom?.roomType}
              </DialogDescription>
            </DialogHeader>
            
            {selectedRoom && (
              <div className="space-y-6">
                {/* Room Image */}
                <div className="relative aspect-[3/2] overflow-hidden rounded-lg">
                  <img
                    src={
                      selectedRoom.images?.[0]?.image 
                        ? urlFor(selectedRoom.images[0].image).width(1920).height(1280).url()
                        : selectedRoom.images?.[0] 
                        ? `/${selectedRoom.images[0]}`
                        : '/stock_apart1.png'
                    }
                    alt={selectedRoom.images?.[0]?.alt || `Room ${selectedRoom.roomNumber}`}
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Price Badge */}
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-teal-600 text-white text-lg px-3 py-1">
                      ${selectedRoom.priceMonthly}/month
                    </Badge>
                  </div>
                </div>

                {/* Room Details Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-lg mb-3">Room Details</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Room Name:</span>
                        <span className="font-medium">{selectedRoom.roomName || selectedRoom.roomNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Type:</span>
                        <span className="font-medium">{selectedRoom.roomType}</span>
                      </div>
                      {selectedRoom.sizeSqm && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Size:</span>
                          <span className="font-medium">{selectedRoom.sizeSqm} sqm</span>
                        </div>
                      )}
                      {selectedRoom.floor && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Floor:</span>
                          <span className="font-medium">{selectedRoom.floor}</span>
                        </div>
                      )}
                      {selectedRoom.facing && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Facing:</span>
                          <span className="font-medium">{selectedRoom.facing}</span>
                        </div>
                      )}
                      {selectedRoom.window !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Window:</span>
                          <span className="font-medium">{selectedRoom.window ? 'Yes' : 'No'}</span>
                        </div>
                      )}
                      {(selectedRoom.bathType || selectedRoom.bathroom) && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Bathroom:</span>
                          <span className="font-medium">{selectedRoom.bathType || selectedRoom.bathroom || 'Shared'}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-lg mb-3">Availability</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Status:</span>
                        <Badge variant={selectedRoom.isAvailable ? 'default' : 'secondary'}>
                          {selectedRoom.isAvailable ? 'Available' : 'Occupied'}
                        </Badge>
                      </div>
                      {selectedRoom.availableFrom && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Available from:</span>
                          <span className="font-medium">{selectedRoom.availableFrom}</span>
                        </div>
                      )}
                      {selectedRoom.leaseTerm && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Minimum lease:</span>
                          <span className="font-medium">{selectedRoom.leaseTerm}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Room Amenities */}
                {selectedRoom.amenities && selectedRoom.amenities.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-lg mb-3">Room Amenities</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedRoom.amenities.map((amenity, index) => (
                        <Badge key={index} variant="outline">
                          {amenity}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                {selectedRoom.description && (
                  <div>
                    <h4 className="font-semibold text-lg mb-3">Description</h4>
                    <p className="text-gray-600 leading-relaxed">{selectedRoom.description}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-3 pt-4 border-t">
                  <a 
                    href={`https://wa.me/6580885410?text=Hi! I'm interested in ${selectedRoom.roomName || selectedRoom.roomNumber} @ ${property?.name}. The room is $${selectedRoom.priceMonthly}/month and ${selectedRoom.sizeSqm ? selectedRoom.sizeSqm + ' sqm' : 'perfect for me'}. Could you please provide more information about availability and next steps? Thank you!`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Button className="w-full bg-green-600 hover:bg-green-700">
                      <MessageCircle className="w-4 h-4 mr-2" />
                      WhatsApp Inquiry
                    </Button>
                  </a>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowRoomDetailsDialog(false)}
                    className="px-6"
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default PropertyDetailPage;