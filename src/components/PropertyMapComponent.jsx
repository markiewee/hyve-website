import { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Layers, RotateCcw, Filter, X } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';

const PropertyMapComponent = ({ 
  property, 
  height = '500px',
  className = '',
  showFilters = true
}) => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [viewMode, setViewMode] = useState('2d');
  const [markers, setMarkers] = useState([]);
  const [activeFilters, setActiveFilters] = useState({
    transport: true,
    shopping: true,
    dining: true,
    healthcare: true,
    fitness: true,
    banking: true,
    grocery: true,
    pharmacy: true
  });

  const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyB3cHdRaUsbf_HtV4t8CFfCcK0bdpDGzMA';

  // Enhanced amenity types for Singapore
  const amenityTypes = [
    {
      key: 'transport',
      type: 'transit_station',
      radius: 1000,
      limit: 8,
      color: '#f59e0b',
      icon: 'M8 12h8M12 8v8',
      category: 'Transport',
      description: 'MRT/Bus stations'
    },
    {
      key: 'shopping',
      type: 'shopping_mall',
      radius: 2000,
      limit: 5,
      color: '#8b5cf6',
      icon: 'M7 9l5 5 5-5',
      category: 'Shopping',
      description: 'Malls & Shopping'
    },
    {
      key: 'dining',
      type: 'restaurant',
      radius: 800,
      limit: 12,
      color: '#ef4444',
      icon: 'M12 2l1 7h4l-3 5-1-7H9l3-5z',
      category: 'Dining',
      description: 'Restaurants & Cafes'
    },
    {
      key: 'healthcare',
      type: 'hospital',
      radius: 3000,
      limit: 3,
      color: '#22c55e',
      icon: 'M12 2v8m-4-4h8',
      category: 'Healthcare',
      description: 'Hospitals & Clinics'
    },
    {
      key: 'fitness',
      type: 'gym',
      radius: 1500,
      limit: 6,
      color: '#f97316',
      icon: 'M6 12h12M12 6v12',
      category: 'Fitness',
      description: 'Gyms & Sports'
    },
    {
      key: 'banking',
      type: 'bank',
      radius: 1200,
      limit: 5,
      color: '#3b82f6',
      icon: 'M3 21h18M12 21V7l-8 4v10l8-4 8 4V11l-8-4z',
      category: 'Banking',
      description: 'Banks & ATMs'
    },
    {
      key: 'grocery',
      type: 'supermarket',
      radius: 1000,
      limit: 8,
      color: '#10b981',
      icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4m1.6 8L6 5H4m3 8v6a1 1 0 001 1h1a1 1 0 001-1v-6m-6 0h8',
      category: 'Grocery',
      description: 'Supermarkets'
    },
    {
      key: 'pharmacy',
      type: 'pharmacy',
      radius: 1500,
      limit: 4,
      color: '#06b6d4',
      icon: 'M12 2v8m-4-4h8',
      category: 'Pharmacy',
      description: 'Pharmacies'
    }
  ];

  useEffect(() => {
    if (!property) return;

    const loadGoogleMaps = () => {
      if (window.google && window.google.maps) {
        initializeMap();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geometry&v=3.exp`;
      script.async = true;
      script.defer = true;
      script.onload = initializeMap;
      document.head.appendChild(script);
    };

    const initializeMap = () => {
      if (!mapRef.current || !property) return;

      const propertyLat = property.location?.latitude || property.latitude;
      const propertyLng = property.location?.longitude || property.longitude;

      if (!propertyLat || !propertyLng) {
        console.warn('Property coordinates not available');
        return;
      }

      const mapOptions = {
        center: { lat: propertyLat, lng: propertyLng },
        zoom: 15,
        mapTypeId: 'roadmap',
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'on' }]
          },
          {
            featureType: 'transit.station',
            elementType: 'labels',
            stylers: [{ visibility: 'on' }]
          }
        ],
        mapTypeControl: false,
        streetViewControl: true,
        fullscreenControl: true,
        zoomControl: true,
        gestureHandling: 'cooperative'
      };

      const newMap = new window.google.maps.Map(mapRef.current, mapOptions);

      // Add property marker
      const propertyMarker = new window.google.maps.Marker({
        position: { lat: propertyLat, lng: propertyLng },
        map: newMap,
        title: property.name,
        icon: {
          url: '/hyve_map_pin_orange.png',
          scaledSize: new window.google.maps.Size(50, 50),
          anchor: new window.google.maps.Point(25, 50)
        }
      });

      // Property info window
      const propertyInfoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 12px; max-width: 280px;">
            <h3 style="margin: 0 0 8px 0; color: #0d9488; font-size: 18px; font-weight: bold;">${property.name}</h3>
            <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">${property.address}</p>
            <p style="margin: 0 0 8px 0; color: #0d9488; font-weight: bold; font-size: 16px;">From $${property.startingPrice}/month</p>
            <p style="margin: 0; color: #666; font-size: 12px;">${property.availableRooms} rooms available</p>
          </div>
        `
      });

      propertyMarker.addListener('click', () => {
        propertyInfoWindow.open(newMap, propertyMarker);
      });

      setMap(newMap);
      setIsLoaded(true);
      
      // Load amenities
      loadAmenities(newMap, property);
    };

    loadGoogleMaps();
  }, [property]);

  // Reload amenities when filters change
  useEffect(() => {
    if (map && property && isLoaded) {
      // Clear existing markers
      markers.forEach(marker => marker.setMap(null));
      setMarkers([]);
      
      // Reload with new filters
      loadAmenities(map, property);
    }
  }, [activeFilters, map, isLoaded]);

  const loadAmenities = (map, property) => {
    const service = new window.google.maps.places.PlacesService(map);
    const propertyLat = property.location?.latitude || property.latitude;
    const propertyLng = property.location?.longitude || property.longitude;
    const location = new window.google.maps.LatLng(propertyLat, propertyLng);
    const newMarkers = [];

    // Filter amenities based on active filters
    const activeAmenities = amenityTypes.filter(amenity => activeFilters[amenity.key]);

    activeAmenities.forEach(amenity => {
      service.nearbySearch({
        location: location,
        radius: amenity.radius,
        type: amenity.type
      }, (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          results.slice(0, amenity.limit).forEach((place) => {
            const marker = new window.google.maps.Marker({
              position: place.geometry.location,
              map: map,
              title: `${place.name} (${amenity.category})`,
              icon: {
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="14" cy="14" r="12" fill="${amenity.color}" stroke="white" stroke-width="2"/>
                    <path d="${amenity.icon}" stroke="white" stroke-width="1.5" fill="none" transform="translate(2, 2) scale(0.8)"/>
                  </svg>
                `),
                scaledSize: new window.google.maps.Size(28, 28)
              }
            });

            // Calculate distance
            const distance = window.google.maps.geometry.spherical.computeDistanceBetween(
              location,
              place.geometry.location
            );
            const distanceInKm = (distance / 1000).toFixed(1);

            const infoWindow = new window.google.maps.InfoWindow({
              content: `
                <div style="padding: 10px; max-width: 220px;">
                  <h4 style="margin: 0 0 6px 0; color: ${amenity.color}; font-size: 15px; font-weight: bold;">${place.name}</h4>
                  <p style="margin: 0 0 4px 0; color: #666; font-size: 13px;">${amenity.category}</p>
                  ${place.rating ? `<p style="margin: 0 0 4px 0; color: #f59e0b; font-size: 12px;">★ ${place.rating}/5 ${place.user_ratings_total ? `(${place.user_ratings_total} reviews)` : ''}</p>` : ''}
                  <p style="margin: 0 0 4px 0; color: #0d9488; font-size: 12px; font-weight: bold;">${distanceInKm}km away</p>
                  ${place.vicinity ? `<p style="margin: 0; color: #666; font-size: 11px;">${place.vicinity}</p>` : ''}
                </div>
              `
            });

            marker.addListener('click', () => {
              infoWindow.open(map, marker);
            });

            newMarkers.push(marker);
          });
        }
      });
    });

    setMarkers(newMarkers);
  };

  const toggle3D = () => {
    if (!map) return;
    if (viewMode === '2d') {
      map.setTilt(45);
      map.setMapTypeId('satellite');
      setViewMode('3d');
    } else {
      map.setTilt(0);
      map.setMapTypeId('roadmap');
      setViewMode('2d');
    }
  };

  const resetView = () => {
    if (!map || !property) return;
    const propertyLat = property.location?.latitude || property.latitude;
    const propertyLng = property.location?.longitude || property.longitude;
    
    map.setCenter({ lat: propertyLat, lng: propertyLng });
    map.setZoom(15);
    map.setTilt(0);
    map.setHeading(0);
    setViewMode('2d');
  };

  const toggleFilter = (filterKey) => {
    setActiveFilters(prev => ({
      ...prev,
      [filterKey]: !prev[filterKey]
    }));
  };

  if (!property || (!property.location?.latitude && !property.latitude)) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Property location not available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="p-0 relative">
        {/* Map Container */}
        <div 
          ref={mapRef} 
          style={{ height, width: '100%' }}
          className="rounded-lg"
        />
        
        {/* Loading Overlay */}
        {!isLoaded && (
          <div className="absolute inset-0 bg-gray-100 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading enhanced map...</p>
            </div>
          </div>
        )}

        {/* Map Controls */}
        {isLoaded && (
          <div className="absolute top-4 right-4 flex flex-col gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={toggle3D}
              className="bg-white/90 hover:bg-white shadow-md"
            >
              <Layers className="w-4 h-4 mr-1" />
              {viewMode === '2d' ? '3D' : '2D'}
            </Button>
            
            <Button
              size="sm"
              variant="secondary"
              onClick={resetView}
              className="bg-white/90 hover:bg-white shadow-md"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Amenity Filters */}
        {isLoaded && showFilters && (
          <div className="absolute top-4 left-4 bg-white/95 rounded-lg p-3 shadow-md max-w-xs">
            <h4 className="font-semibold text-sm mb-2 flex items-center">
              <Filter className="w-4 h-4 mr-1" />
              Nearby Amenities
            </h4>
            <div className="space-y-2">
              {amenityTypes.map(amenity => (
                <label key={amenity.key} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeFilters[amenity.key]}
                    onChange={() => toggleFilter(amenity.key)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: amenity.color }}
                    ></div>
                    <span className="text-xs">{amenity.category}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Property Info Overlay */}
        <div className="absolute bottom-4 right-4 bg-white/95 rounded-lg p-3 shadow-md max-w-xs">
          <h4 className="font-semibold text-sm mb-1">{property.name}</h4>
          <p className="text-xs text-gray-600 mb-1">{property.neighborhood?.name || property.neighborhood}</p>
          <p className="text-xs text-teal-600 font-semibold">
            {property.availableRooms} rooms available from ${property.startingPrice}/mo
          </p>
          {property.walkScore && (
            <p className="text-xs text-gray-600 mt-1">
              Walk Score: {property.walkScore}/100
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PropertyMapComponent;