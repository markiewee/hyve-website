import { useState, useEffect } from 'react';

const PropertiesPageSimple = ({ searchFilters, setSearchFilters }) => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:5001/api/properties');
        const data = await response.json();
        setProperties(data);
      } catch (error) {
        console.error("Error fetching properties:", error);
        setProperties([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProperties();
  }, []);

  if (loading) {
    return <div className="p-8">Loading properties...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Properties</h1>
        <p>Found {properties.length} properties</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-8">
          {properties.map((property) => (
            <div key={property.id} className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-semibold mb-2">{property.name}</h3>
              <p className="text-gray-600 mb-2">{property.neighborhood}</p>
              <p className="text-green-600 font-bold">${property.startingPrice}/month</p>
              <p className="text-sm text-gray-500">{property.availableRooms} rooms available</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PropertiesPageSimple;