// Sample properties data
const SAMPLE_PROPERTIES = [
  {
    id: 1,
    name: "Modern Coliving Hub - Lentor",
    description: "Experience contemporary living in this stylish coliving space located in the heart of Lentor. Features modern amenities, flexible lease terms, and a vibrant community atmosphere.",
    address: "123 Lentor Avenue, Singapore 789012",
    neighborhood: "Lentor",
    propertyType: "Condo",
    totalRooms: 8,
    availableRooms: 3,
    startingPrice: 1200,
    images: ["hero_coliving_interior.jpg", "modern_coliving_space.jpg"],
    amenities: ["High-Speed WiFi", "24/7 Security", "Parking Available", "Responsive Maintenance", "Weekly Housekeeping", "Community Events"],
    nearbyMRT: ["Lentor MRT (2 min walk)", "Mayflower MRT (8 min walk)"],
    nearbyAmenities: ["Shopping Mall (3 min)", "Supermarket (5 min)", "Restaurants (1 min)", "Gym (2 min)", "Park (8 min)"]
  },
  {
    id: 2,
    name: "Urban Sanctuary - Orchard",
    description: "Live in the heart of Singapore's shopping district with premium coliving amenities. This property offers luxury living with convenient access to Orchard Road's best attractions.",
    address: "456 Orchard Boulevard, Singapore 238123",
    neighborhood: "Orchard",
    propertyType: "Condo",
    totalRooms: 12,
    availableRooms: 5,
    startingPrice: 1800,
    images: ["orchard_building.jpg", "singapore_apartment_living.jpg"],
    amenities: ["WiFi Included", "24/7 Security", "Parking", "Maintenance", "Housekeeping", "Community Events"],
    nearbyMRT: ["Orchard MRT (1 min walk)", "Somerset MRT (5 min walk)"],
    nearbyAmenities: ["Ion Orchard (2 min)", "Cold Storage (3 min)", "Food Court (1 min)", "Virgin Active (1 min)", "Botanic Gardens (10 min)"]
  },
  {
    id: 3,
    name: "Riverside Living - River Valley",
    description: "Enjoy peaceful riverside living with modern conveniences. This coliving space combines tranquility with urban accessibility, perfect for professionals and students alike.",
    address: "789 River Valley Road, Singapore 179024",
    neighborhood: "River Valley",
    propertyType: "Apartment",
    totalRooms: 6,
    availableRooms: 2,
    startingPrice: 1500,
    images: ["river_valley_exterior.jpg", "shared_kitchen.jpg"],
    amenities: ["High-Speed WiFi", "Security", "Maintenance", "Weekly Housekeeping"],
    nearbyMRT: ["Great World MRT (5 min walk)", "Tiong Bahru MRT (8 min walk)"],
    nearbyAmenities: ["Great World Mall (5 min)", "FairPrice (4 min)", "Hawker Center (3 min)", "Fitness First (6 min)", "Singapore River (2 min)"]
  },
  {
    id: 4,
    name: "Heritage Charm - Tiong Bahru",
    description: "Experience Singapore's heritage charm in this beautifully restored coliving space. Located in the trendy Tiong Bahru neighborhood with excellent cafes and local culture.",
    address: "321 Tiong Bahru Road, Singapore 168732",
    neighborhood: "Tiong Bahru",
    propertyType: "Heritage",
    totalRooms: 5,
    availableRooms: 1,
    startingPrice: 1300,
    images: ["tiong_bahru_neighborhood.jpg", "modern_condo_exterior.jpg"],
    amenities: ["WiFi", "Security", "Maintenance", "Housekeeping"],
    nearbyMRT: ["Tiong Bahru MRT (3 min walk)", "Outram Park MRT (10 min walk)"],
    nearbyAmenities: ["Tiong Bahru Market (2 min)", "Sheng Siong (3 min)", "Local Cafes (1 min)", "Community Center (4 min)", "Tiong Bahru Park (5 min)"]
  }
];

export default function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    const { neighborhood, min_price, max_price, property_type, available_only, available_from } = req.query;
    
    let filteredProperties = [...SAMPLE_PROPERTIES];
    
    // Filter by neighborhood
    if (neighborhood) {
      filteredProperties = filteredProperties.filter(p => 
        p.neighborhood.toLowerCase().includes(neighborhood.toLowerCase())
      );
    }
    
    // Filter by price range
    if (min_price) {
      filteredProperties = filteredProperties.filter(p => 
        p.startingPrice >= parseFloat(min_price)
      );
    }
    
    if (max_price) {
      filteredProperties = filteredProperties.filter(p => 
        p.startingPrice <= parseFloat(max_price)
      );
    }
    
    // Filter by property type
    if (property_type) {
      filteredProperties = filteredProperties.filter(p => 
        p.propertyType.toLowerCase().includes(property_type.toLowerCase())
      );
    }
    
    // Filter by availability
    if (available_only === 'true') {
      filteredProperties = filteredProperties.filter(p => p.availableRooms > 0);
    }

    // Filter by available from date
    if (available_from) {
      const requestedDate = new Date(available_from);
      filteredProperties = filteredProperties.filter(p => {
        // For now, assume properties are available if requested date is in the future
        // In a real implementation, you'd check room availability dates
        return true; // This would need room data integration
      });
    }
    
    res.status(200).json(filteredProperties);
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}