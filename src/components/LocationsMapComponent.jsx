import { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

const LocationsMapComponent = ({ 
  properties = [],
  neighborhoods = [], 
  height = '600px',
  className = '',
  onPropertySelect
}) => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [currentZoom, setCurrentZoom] = useState(11);
  const [neighborhoodMarkers, setNeighborhoodMarkers] = useState([]);
  const [propertyMarkers, setPropertyMarkers] = useState([]);

  const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyB3cHdRaUsbf_HtV4t8CFfCcK0bdpDGzMA';

  useEffect(() => {
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
      if (!mapRef.current) return;

      // Default to Singapore center
      const center = { lat: 1.3521, lng: 103.8198 };
      
      // If we have properties, calculate center
      if (properties.length > 0) {
        const validProperties = properties.filter(p => 
          (p.location?.latitude || p.latitude) && (p.location?.longitude || p.longitude)
        );
        
        if (validProperties.length > 0) {
          const avgLat = validProperties.reduce((sum, p) => 
            sum + (p.location?.latitude || p.latitude), 0) / validProperties.length;
          const avgLng = validProperties.reduce((sum, p) => 
            sum + (p.location?.longitude || p.longitude), 0) / validProperties.length;
          center.lat = avgLat;
          center.lng = avgLng;
        }
      }

      const mapOptions = {
        center,
        zoom: properties.length > 0 ? 12 : 11,
        mapTypeId: 'roadmap',
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'on' }]
          }
        ],
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
        zoomControl: true,
        gestureHandling: 'cooperative'
      };

      const newMap = new window.google.maps.Map(mapRef.current, mapOptions);
      
      // Add zoom change listener
      newMap.addListener('zoom_changed', () => {
        const zoom = newMap.getZoom();
        setCurrentZoom(zoom);
        updateMarkersBasedOnZoom(newMap, zoom);
      });

      // Add neighborhood markers
      if (neighborhoods.length > 0) {
        addNeighborhoodMarkers(newMap);
      }

      // Initially hide property markers (they'll show when zoomed in)
      if (properties.length > 0) {
        addPropertyMarkers(newMap, false); // false = initially hidden
      }

      setMap(newMap);
      setIsLoaded(true);
    };

    loadGoogleMaps();
  }, [properties, neighborhoods]);

  const addPropertyMarkers = (map, visible = true) => {
    const newPropertyMarkers = [];
    
    properties.forEach((property) => {
      const lat = property.location?.latitude || property.latitude;
      const lng = property.location?.longitude || property.longitude;
      
      if (!lat || !lng) return;

      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        map: visible ? map : null, // Only show if visible is true
        title: property.name,
        icon: {
          url: '/hyve_map_pin_orange.png',
          scaledSize: new window.google.maps.Size(40, 40),
          anchor: new window.google.maps.Point(20, 40)
        }
      });

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 12px; max-width: 300px;">
            <h3 style="margin: 0 0 8px 0; color: #0d9488; font-size: 16px; font-weight: bold;">${property.name}</h3>
            <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">${property.address}</p>
            <p style="margin: 0 0 8px 0; color: #666; font-size: 13px;">${property.neighborhood?.name || property.neighborhood || ''}</p>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <p style="margin: 0; color: #0d9488; font-weight: bold; font-size: 15px;">From $${property.startingPrice}/month</p>
              <p style="margin: 0; color: #666; font-size: 12px;">${property.availableRooms} available</p>
            </div>
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(map, marker);
        setSelectedProperty(property);
        if (onPropertySelect) {
          onPropertySelect(property);
        }
      });

      newPropertyMarkers.push(marker);
    });
    
    setPropertyMarkers(newPropertyMarkers);
  };

  const addNeighborhoodMarkers = (map) => {
    const newNeighborhoodMarkers = [];
    
    neighborhoods.forEach(neighborhood => {
      const lat = neighborhood.location?.latitude;
      const lng = neighborhood.location?.longitude;
      
      if (!lat || !lng) return;

      // Calculate number of properties in this neighborhood
      const propertiesInNeighborhood = properties.filter(property => {
        const neighborhoodName = property.neighborhood?.name || property.neighborhood;
        return neighborhoodName === neighborhood.name;
      }).length;

      // Add neighborhood center marker with property count
      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        map,
        title: neighborhood.name,
        icon: {
          url: '/hyve_map_pin_green.png',
          scaledSize: new window.google.maps.Size(50, 50),
          anchor: new window.google.maps.Point(25, 50)
        }
      });

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 12px; max-width: 280px;">
            <h4 style="margin: 0 0 8px 0; color: #8b5cf6; font-size: 16px; font-weight: bold;">${neighborhood.name}</h4>
            <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">${neighborhood.description || 'Popular neighborhood'}</p>
            <p style="margin: 0 0 8px 0; color: #0d9488; font-weight: bold;">${propertiesInNeighborhood} ${propertiesInNeighborhood === 1 ? 'property' : 'properties'} available</p>
            ${neighborhood.highlights ? `
              <div style="margin-top: 8px;">
                ${neighborhood.highlights.slice(0, 3).map(highlight => `
                  <span style="display: inline-block; background: #f3f4f6; color: #374151; padding: 3px 8px; border-radius: 6px; font-size: 12px; margin: 2px;">${highlight}</span>
                `).join('')}
              </div>
            ` : ''}
            <p style="margin: 8px 0 0 0; color: #666; font-size: 12px; font-style: italic;">Zoom in to see individual properties</p>
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(map, marker);
      });

      newNeighborhoodMarkers.push(marker);
    });
    
    setNeighborhoodMarkers(newNeighborhoodMarkers);
  };

  // Function to update marker visibility based on zoom level
  const updateMarkersBasedOnZoom = (map, zoom) => {
    const showProperties = zoom >= 14; // Show individual properties when zoomed in
    
    // Toggle neighborhood markers
    neighborhoodMarkers.forEach(marker => {
      marker.setMap(showProperties ? null : map);
    });
    
    // Toggle property markers
    propertyMarkers.forEach(marker => {
      marker.setMap(showProperties ? map : null);
    });
  };

  const resetView = () => {
    if (!map) return;
    
    if (properties.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      properties.forEach(property => {
        const lat = property.location?.latitude || property.latitude;
        const lng = property.location?.longitude || property.longitude;
        if (lat && lng) {
          bounds.extend({ lat, lng });
        }
      });
      map.fitBounds(bounds);
    } else {
      map.setCenter({ lat: 1.3521, lng: 103.8198 });
      map.setZoom(11);
    }
  };

  return (
    <Card className={className}>
      <CardContent className="p-0 relative">
        <div 
          ref={mapRef} 
          style={{ height, width: '100%' }}
          className="rounded-lg"
        />
        
        {!isLoaded && (
          <div className="absolute inset-0 bg-gray-100 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading locations map...</p>
            </div>
          </div>
        )}

        {isLoaded && (
          <div className="absolute top-4 right-4 flex flex-col gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={resetView}
              className="bg-white/90 hover:bg-white shadow-md"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Fit All
            </Button>
          </div>
        )}


        {/* Map Info Overlay */}
        {isLoaded && (
          <div className="absolute bottom-4 left-4 bg-white/95 rounded-lg p-3 shadow-md">
            <div className="text-xs text-gray-600">
              {currentZoom >= 14 ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-orange-500 rounded-full border border-orange-600"></div>
                  <span>Showing individual properties</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded-full border border-green-600"></div>
                  <span>Showing neighborhoods • Zoom in for properties</span>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedProperty && (
          <div className="absolute bottom-4 right-4 bg-white/95 rounded-lg p-3 shadow-md max-w-xs">
            <h4 className="font-semibold text-sm mb-1">{selectedProperty.name}</h4>
            <p className="text-xs text-gray-600 mb-1">{selectedProperty.neighborhood?.name || selectedProperty.neighborhood}</p>
            <p className="text-xs text-teal-600 font-semibold">
              From ${selectedProperty.startingPrice}/mo • {selectedProperty.availableRooms} available
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LocationsMapComponent;