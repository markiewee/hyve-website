import { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Layers, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

const MapComponent = ({ 
  property, 
  showNearbyAmenities = true, 
  height = '400px',
  className = '' 
}) => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [viewMode, setViewMode] = useState('2d'); // '2d' or '3d'
  const [showAmenities, setShowAmenities] = useState(showNearbyAmenities);

  // Google Maps API key - In production, this should be in environment variables
  const GOOGLE_MAPS_API_KEY = 'AIzaSyB3cHdRaUsbf_HtV4t8CFfCcK0bdpDGzMA';

  useEffect(() => {
    // Load Google Maps API
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

      const mapOptions = {
        center: { 
          lat: property.latitude || 1.3521, 
          lng: property.longitude || 103.8198 
        },
        zoom: 16,
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
        position: { 
          lat: property.latitude || 1.3521, 
          lng: property.longitude || 103.8198 
        },
        map: newMap,
        title: property.name,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="20" cy="20" r="18" fill="#0d9488" stroke="white" stroke-width="4"/>
              <circle cx="20" cy="20" r="8" fill="white"/>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(40, 40),
          anchor: new window.google.maps.Point(20, 20)
        }
      });

      // Add info window
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 10px; max-width: 250px;">
            <h3 style="margin: 0 0 8px 0; color: #0d9488; font-size: 16px;">${property.name}</h3>
            <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">${property.address}</p>
            <p style="margin: 0; color: #0d9488; font-weight: bold;">From $${property.startingPrice}/month</p>
          </div>
        `
      });

      propertyMarker.addListener('click', () => {
        infoWindow.open(newMap, propertyMarker);
      });

      // Add nearby amenities if enabled
      if (showAmenities) {
        addNearbyAmenities(newMap, property);
      }

      setMap(newMap);
      setIsLoaded(true);
    };

    loadGoogleMaps();
  }, [property, showAmenities]);

  const addNearbyAmenities = (map, property) => {
    const service = new window.google.maps.places.PlacesService(map);
    const location = new window.google.maps.LatLng(
      property.latitude || 1.3521, 
      property.longitude || 103.8198
    );

    // Search for nearby MRT stations
    service.nearbySearch({
      location: location,
      radius: 1000,
      type: 'transit_station'
    }, (results, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK) {
        results.slice(0, 3).forEach(place => {
          new window.google.maps.Marker({
            position: place.geometry.location,
            map: map,
            title: place.name,
            icon: {
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" fill="#f59e0b" stroke="white" stroke-width="2"/>
                  <path d="M8 12h8M12 8v8" stroke="white" stroke-width="2"/>
                </svg>
              `),
              scaledSize: new window.google.maps.Size(24, 24)
            }
          });
        });
      }
    });

    // Search for nearby shopping centers
    service.nearbySearch({
      location: location,
      radius: 1500,
      type: 'shopping_mall'
    }, (results, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK) {
        results.slice(0, 2).forEach(place => {
          new window.google.maps.Marker({
            position: place.geometry.location,
            map: map,
            title: place.name,
            icon: {
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" fill="#8b5cf6" stroke="white" stroke-width="2"/>
                  <path d="M7 9l5 5 5-5" stroke="white" stroke-width="2"/>
                </svg>
              `),
              scaledSize: new window.google.maps.Size(24, 24)
            }
          });
        });
      }
    });
  };

  const toggle3D = () => {
    if (!map) return;

    if (viewMode === '2d') {
      // Switch to 3D view
      map.setTilt(45);
      map.setMapTypeId('satellite');
      setViewMode('3d');
    } else {
      // Switch back to 2D view
      map.setTilt(0);
      map.setMapTypeId('roadmap');
      setViewMode('2d');
    }
  };

  const resetView = () => {
    if (!map || !property) return;

    map.setCenter({ 
      lat: property.latitude || 1.3521, 
      lng: property.longitude || 103.8198 
    });
    map.setZoom(16);
    map.setTilt(0);
    map.setHeading(0);
    setViewMode('2d');
  };

  const toggleAmenities = () => {
    setShowAmenities(!showAmenities);
    if (map) {
      // Clear existing markers and re-add if needed
      // This is a simplified approach - in production, you'd track markers
      if (!showAmenities) {
        addNearbyAmenities(map, property);
      }
    }
  };

  if (!property) {
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
              <p className="text-gray-600">Loading map...</p>
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
            
            <Button
              size="sm"
              variant="secondary"
              onClick={toggleAmenities}
              className="bg-white/90 hover:bg-white shadow-md"
            >
              <Navigation className="w-4 h-4 mr-1" />
              POI
            </Button>
          </div>
        )}

        {/* Map Legend */}
        {isLoaded && showAmenities && (
          <div className="absolute bottom-4 left-4 bg-white/90 rounded-lg p-3 shadow-md">
            <h4 className="font-semibold text-sm mb-2">Legend</h4>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-teal-600"></div>
                <span>Property</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-amber-500"></div>
                <span>MRT Station</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-purple-500"></div>
                <span>Shopping</span>
              </div>
            </div>
          </div>
        )}

        {/* Property Info Overlay */}
        <div className="absolute bottom-4 right-4 bg-white/90 rounded-lg p-3 shadow-md max-w-xs">
          <h4 className="font-semibold text-sm mb-1">{property.name}</h4>
          <p className="text-xs text-gray-600 mb-1">{property.neighborhood}</p>
          <p className="text-xs text-teal-600 font-semibold">
            {property.availableRooms} rooms available from ${property.startingPrice}/mo
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default MapComponent;

