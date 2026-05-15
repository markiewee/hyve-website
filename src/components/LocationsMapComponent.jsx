import { useState, useEffect, useRef, useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Fix default marker icon issue with bundlers (webpack/vite strip the default icon paths)
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Lazybee teal neighborhood icon
const neighborhoodIcon = new L.DivIcon({
  className: 'custom-neighborhood-icon',
  html: `<div style="
    width: 36px; height: 36px;
    background: #A87813;
    border: 3px solid #fff;
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    display: flex; align-items: center; justify-content: center;
  ">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -20],
});

// Property marker icon (orange)
const propertyIcon = new L.DivIcon({
  className: 'custom-property-icon',
  html: `<div style="
    width: 32px; height: 32px;
    background: #f97316;
    border: 3px solid #fff;
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    display: flex; align-items: center; justify-content: center;
  ">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -18],
});

// Component to track zoom level changes
function ZoomTracker({ onZoomChange }) {
  useMapEvents({
    zoomend: (e) => {
      onZoomChange(e.target.getZoom());
    },
  });
  return null;
}

// Component to handle "Fit All" from outside the map
function FitBoundsControl({ bounds, trigger }) {
  const map = useMap();

  useEffect(() => {
    if (trigger > 0 && bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [trigger, bounds, map]);

  return null;
}

const LocationsMapComponent = ({
  properties = [],
  neighborhoods = [],
  height = '600px',
  className = '',
  onPropertySelect,
}) => {
  const [currentZoom, setCurrentZoom] = useState(12);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [fitTrigger, setFitTrigger] = useState(0);

  const showProperties = currentZoom >= 14;

  // Calculate map center from properties or fall back to Singapore
  const center = useMemo(() => {
    const validProperties = properties.filter(
      (p) => (p.location?.latitude || p.latitude) && (p.location?.longitude || p.longitude)
    );
    if (validProperties.length > 0) {
      const avgLat =
        validProperties.reduce((sum, p) => sum + (p.location?.latitude || p.latitude), 0) /
        validProperties.length;
      const avgLng =
        validProperties.reduce((sum, p) => sum + (p.location?.longitude || p.longitude), 0) /
        validProperties.length;
      return [avgLat, avgLng];
    }
    return [1.3521, 103.8198];
  }, [properties]);

  // Compute bounds for fit-all
  const bounds = useMemo(() => {
    const allPoints = [];
    properties.forEach((p) => {
      const lat = p.location?.latitude || p.latitude;
      const lng = p.location?.longitude || p.longitude;
      if (lat && lng) allPoints.push([lat, lng]);
    });
    neighborhoods.forEach((n) => {
      const lat = n.location?.latitude;
      const lng = n.location?.longitude;
      if (lat && lng) allPoints.push([lat, lng]);
    });
    if (allPoints.length > 0) {
      return L.latLngBounds(allPoints);
    }
    return L.latLngBounds([[1.25, 103.7], [1.45, 103.95]]);
  }, [properties, neighborhoods]);

  const handlePropertyClick = (property) => {
    setSelectedProperty(property);
    if (onPropertySelect) {
      onPropertySelect(property);
    }
  };

  const resetView = () => {
    setFitTrigger((t) => t + 1);
  };

  return (
    <Card className={className}>
      <CardContent className="p-0 relative">
        <MapContainer
          center={center}
          zoom={properties.length > 0 ? 12 : 11}
          style={{ height, width: '100%' }}
          className="rounded-lg z-0"
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            className="lazybee-map-tiles"
          />

          <ZoomTracker onZoomChange={setCurrentZoom} />
          <FitBoundsControl bounds={bounds} trigger={fitTrigger} />

          {/* Neighborhood markers - shown when zoomed out */}
          {!showProperties &&
            neighborhoods.map((neighborhood, idx) => {
              const lat = neighborhood.location?.latitude;
              const lng = neighborhood.location?.longitude;
              if (!lat || !lng) return null;

              const matchingProperties = properties.filter((property) => {
                const neighborhoodName = property.neighborhood?.name || property.neighborhood;
                return neighborhoodName === neighborhood.name;
              });
              const propertiesInNeighborhood = matchingProperties.length;

              return (
                <Marker key={`n-${idx}`} position={[lat, lng]} icon={neighborhoodIcon}>
                  <Popup>
                    <div style={{ maxWidth: 260 }}>
                      <h4 style={{ margin: '0 0 6px', color: '#A87813', fontSize: 15, fontWeight: 700 }}>
                        {neighborhood.name}
                      </h4>
                      <p style={{ margin: '0 0 6px', color: '#666', fontSize: 13 }}>
                        {neighborhood.description || 'Popular neighborhood'}
                      </p>
                      <p style={{ margin: '0 0 6px', color: '#A87813', fontWeight: 600, fontSize: 13 }}>
                        {propertiesInNeighborhood} {propertiesInNeighborhood === 1 ? 'property' : 'properties'} available
                      </p>
                      {neighborhood.highlights && (
                        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {neighborhood.highlights.slice(0, 3).map((h, i) => (
                            <span
                              key={i}
                              style={{
                                background: '#f3f4f6',
                                color: '#374151',
                                padding: '2px 8px',
                                borderRadius: 6,
                                fontSize: 11,
                              }}
                            >
                              {h}
                            </span>
                          ))}
                        </div>
                      )}
                      {matchingProperties.length > 0 && (
                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {matchingProperties.map((p) => (
                            <a
                              key={p._id || p.id}
                              href={`/property/${p.slug?.current || p.id || p._id}`}
                              style={{
                                display: 'block',
                                padding: '6px 10px',
                                background: '#A87813',
                                color: '#fff',
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 600,
                                textDecoration: 'none',
                                textAlign: 'center',
                              }}
                            >
                              {p.name} — from ${p.startingPrice}/mo
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}

          {/* Property markers - shown when zoomed in */}
          {showProperties &&
            properties.map((property, idx) => {
              const lat = property.location?.latitude || property.latitude;
              const lng = property.location?.longitude || property.longitude;
              if (!lat || !lng) return null;

              return (
                <Marker
                  key={`p-${idx}`}
                  position={[parseFloat(lat), parseFloat(lng)]}
                  icon={propertyIcon}
                  eventHandlers={{ click: () => handlePropertyClick(property) }}
                >
                  <Popup>
                    <div style={{ maxWidth: 280 }}>
                      <h3 style={{ margin: '0 0 6px', color: '#f97316', fontSize: 15, fontWeight: 700 }}>
                        {property.name}
                      </h3>
                      <p style={{ margin: '0 0 4px', color: '#666', fontSize: 13 }}>
                        {property.address || ''}
                      </p>
                      <p style={{ margin: '0 0 6px', color: '#666', fontSize: 12 }}>
                        {property.neighborhood?.name || property.neighborhood || ''}
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#A87813', fontWeight: 700, fontSize: 14 }}>
                          From ${property.startingPrice || property.priceMonthly || 'N/A'}/month
                        </span>
                        <span style={{ color: '#666', fontSize: 12 }}>
                          {property.availableRooms || property.totalRooms || 'N/A'} available
                        </span>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
        </MapContainer>

        {/* Controls overlay */}
        <div className="absolute top-4 right-4 flex flex-col gap-2" style={{ zIndex: 1000 }}>
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

        {/* Map Info Overlay */}
        <div className="absolute bottom-4 left-4 bg-white/95 rounded-lg p-3 shadow-md" style={{ zIndex: 1000 }}>
          <div className="text-xs text-gray-600">
            {showProperties ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-500 rounded-full border border-orange-600"></div>
                <span>Showing individual properties</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border-2" style={{ background: '#A87813', borderColor: '#005049' }}></div>
                <span>Showing neighborhoods - Zoom in for properties</span>
              </div>
            )}
          </div>
        </div>

        {/* Selected property info */}
        {selectedProperty && (
          <div className="absolute bottom-4 right-4 bg-white/95 rounded-lg p-3 shadow-md max-w-xs" style={{ zIndex: 1000 }}>
            <h4 className="font-semibold text-sm mb-1">{selectedProperty.name}</h4>
            <p className="text-xs text-gray-600 mb-1">
              {selectedProperty.neighborhood?.name || selectedProperty.neighborhood}
            </p>
            <p className="text-xs font-semibold" style={{ color: '#A87813' }}>
              From ${selectedProperty.startingPrice}/mo - {selectedProperty.availableRooms} available
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LocationsMapComponent;
