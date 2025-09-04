// Sample rooms data
const SAMPLE_ROOMS = [
  // Lentor Property (ID: 1)
  {
    id: 1,
    propertyId: 1,
    roomNumber: "A1",
    roomType: "Master Bedroom",
    priceMonthly: 1400,
    sizeSqm: 25,
    isAvailable: true,
    availableFrom: "2024-07-01",
    images: ["hero_coliving_interior.jpg", "singapore_apartment_living.jpg"],
    amenities: ["Private Bathroom", "Queen Bed", "Study Desk", "Wardrobe", "Air Conditioning", "Window View"]
  },
  {
    id: 2,
    propertyId: 1,
    roomNumber: "A2",
    roomType: "Standard Room",
    priceMonthly: 1200,
    sizeSqm: 18,
    isAvailable: false,
    availableFrom: "2025-02-15",
    images: ["modern_coliving_space.jpg"],
    amenities: ["Shared Bathroom", "Single Bed", "Study Desk", "Wardrobe", "Air Conditioning"]
  },
  {
    id: 3,
    propertyId: 1,
    roomNumber: "A3",
    roomType: "Standard Room",
    priceMonthly: 1250,
    sizeSqm: 20,
    isAvailable: true,
    availableFrom: "2024-08-15",
    images: ["singapore_apartment_living.jpg"],
    amenities: ["Shared Bathroom", "Queen Bed", "Study Desk", "Wardrobe", "Air Conditioning"]
  },
  {
    id: 4,
    propertyId: 1,
    roomNumber: "A4",
    roomType: "Standard Room",
    priceMonthly: 1180,
    sizeSqm: 17,
    isAvailable: true,
    availableFrom: "2024-09-01",
    images: ["hero_coliving_interior.jpg"],
    amenities: ["Shared Bathroom", "Single Bed", "Study Desk", "Wardrobe", "Air Conditioning"]
  },
  // Orchard Property (ID: 2)
  {
    id: 5,
    propertyId: 2,
    roomNumber: "B1",
    roomType: "Master Bedroom",
    priceMonthly: 2000,
    sizeSqm: 30,
    isAvailable: true,
    availableFrom: "2024-07-01",
    images: ["orchard_building.jpg", "hero_coliving_interior.jpg"],
    amenities: ["Private Bathroom", "King Bed", "Study Desk", "Walk-in Wardrobe", "Air Conditioning", "City View", "Balcony"]
  },
  {
    id: 6,
    propertyId: 2,
    roomNumber: "B2",
    roomType: "Deluxe Room",
    priceMonthly: 1800,
    sizeSqm: 22,
    isAvailable: true,
    availableFrom: "2024-07-15",
    images: ["singapore_apartment_living.jpg"],
    amenities: ["Private Bathroom", "Queen Bed", "Study Desk", "Wardrobe", "Air Conditioning", "City View"]
  },
  {
    id: 7,
    propertyId: 2,
    roomNumber: "B3",
    roomType: "Standard Room",
    priceMonthly: 1600,
    sizeSqm: 19,
    isAvailable: false,
    availableFrom: "2025-01-20",
    images: ["modern_coliving_space.jpg"],
    amenities: ["Shared Bathroom", "Queen Bed", "Study Desk", "Wardrobe", "Air Conditioning"]
  },
  // River Valley Property (ID: 3)
  {
    id: 8,
    propertyId: 3,
    roomNumber: "C1",
    roomType: "Master Bedroom",
    priceMonthly: 1650,
    sizeSqm: 24,
    isAvailable: true,
    availableFrom: "2024-08-01",
    images: ["river_valley_exterior.jpg", "shared_kitchen.jpg"],
    amenities: ["Private Bathroom", "Queen Bed", "Study Desk", "Wardrobe", "Air Conditioning", "River View"]
  },
  {
    id: 9,
    propertyId: 3,
    roomNumber: "C2",
    roomType: "Standard Room",
    priceMonthly: 1500,
    sizeSqm: 18,
    isAvailable: true,
    availableFrom: "2024-07-20",
    images: ["singapore_apartment_living.jpg"],
    amenities: ["Shared Bathroom", "Single Bed", "Study Desk", "Wardrobe", "Air Conditioning"]
  },
  // Tiong Bahru Property (ID: 4)
  {
    id: 10,
    propertyId: 4,
    roomNumber: "D1",
    roomType: "Heritage Room",
    priceMonthly: 1300,
    sizeSqm: 20,
    isAvailable: true,
    availableFrom: "2024-08-15",
    images: ["tiong_bahru_neighborhood.jpg", "modern_condo_exterior.jpg"],
    amenities: ["Private Bathroom", "Queen Bed", "Study Desk", "Vintage Wardrobe", "Air Conditioning", "Heritage Features"]
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
    const { property_id, available_only, room_type } = req.query;
    
    let filteredRooms = [...SAMPLE_ROOMS];
    
    // Filter by property ID
    if (property_id) {
      filteredRooms = filteredRooms.filter(r => r.propertyId === parseInt(property_id));
    }
    
    // Filter by availability
    if (available_only === 'true') {
      filteredRooms = filteredRooms.filter(r => r.isAvailable);
    }
    
    // Filter by room type
    if (room_type) {
      filteredRooms = filteredRooms.filter(r => 
        r.roomType.toLowerCase().includes(room_type.toLowerCase())
      );
    }
    
    res.status(200).json(filteredRooms);
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}