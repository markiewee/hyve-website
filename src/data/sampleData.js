export const properties = [
  {
    id: 1,
    name: "Thomson Grove Residence",
    description: "Modern coliving space in the heart of Singapore's Lentor area. Luxurious and quiet living in one of the greenest and most premium neighborhoods.",
    address: "50 Thomson Grove, Singapore 574623",
    latitude: 1.3521,
    longitude: 103.8198,
    neighborhood: "Lentor",
    propertyType: "Condominium",
    totalRooms: 8,
    amenities: ["Swimming Pool", "Gym", "24/7 Security", "Parking", "WiFi", "Housekeeping", "Laundry"],
    images: ["hero_coliving_interior.jpg", "modern_coliving_space.jpg", "singapore_apartment_living.jpg"],
    startingPrice: 900,
    availableRooms: 2,
    nearbyMRT: ["Lentor MRT (5 min walk)", "Mayflower MRT (8 min walk)"],
    nearbyAmenities: ["Thomson Plaza", "Yishun Park", "Lower Seletar Reservoir"],
    walkScore: 85,
    transitScore: 90
  },
  {
    id: 2,
    name: "River Valley Heights",
    description: "Spectacular penthouse-style coliving with breathtaking city views. Located in the prestigious River Valley district with easy access to Orchard Road.",
    address: "15 River Valley Road, Singapore 238362",
    latitude: 1.2966,
    longitude: 103.8449,
    neighborhood: "River Valley",
    propertyType: "Penthouse",
    totalRooms: 6,
    amenities: ["Rooftop Terrace", "City Views", "Premium Furnishing", "Concierge", "WiFi", "Housekeeping"],
    images: ["river_valley_exterior.jpg", "modern_coliving_space.jpg", "shared_kitchen.jpg"],
    startingPrice: 1200,
    availableRooms: 1,
    nearbyMRT: ["Great World MRT (3 min walk)", "Orchard MRT (10 min walk)"],
    nearbyAmenities: ["Great World City", "UE Square", "Robertson Quay", "Clarke Quay"],
    walkScore: 95,
    transitScore: 95
  },
  {
    id: 3,
    name: "Orchard Central Living",
    description: "Prime location coliving space in the heart of Singapore's shopping district. Perfect for young professionals who want to be in the center of it all.",
    address: "181 Orchard Road, Singapore 238872",
    latitude: 1.3048,
    longitude: 103.8318,
    neighborhood: "Orchard",
    propertyType: "Apartment",
    totalRooms: 5,
    amenities: ["Shopping Access", "MRT Nearby", "Restaurants", "WiFi", "Housekeeping", "Flexible Terms"],
    images: ["orchard_building.jpg", "singapore_apartment_living.jpg", "modern_bedroom.jpg"],
    startingPrice: 1100,
    availableRooms: 3,
    nearbyMRT: ["Orchard MRT (2 min walk)", "Somerset MRT (5 min walk)"],
    nearbyAmenities: ["ION Orchard", "Takashimaya", "Paragon", "Ngee Ann City"],
    walkScore: 100,
    transitScore: 100
  },
  {
    id: 4,
    name: "Tiong Bahru Heritage",
    description: "Charming coliving space in Singapore's hippest neighborhood. Art deco architecture meets modern living with a vibrant local community.",
    address: "78 Tiong Bahru Road, Singapore 168732",
    latitude: 1.2859,
    longitude: 103.8267,
    neighborhood: "Tiong Bahru",
    propertyType: "Heritage Building",
    totalRooms: 4,
    amenities: ["Heritage Architecture", "Local Cafes", "Art Scene", "WiFi", "Housekeeping", "Community Events"],
    images: ["tiong_bahru_neighborhood.jpg", "modern_coliving_space.jpg", "shared_kitchen.jpg"],
    startingPrice: 950,
    availableRooms: 2,
    nearbyMRT: ["Tiong Bahru MRT (3 min walk)", "Outram Park MRT (8 min walk)"],
    nearbyAmenities: ["Tiong Bahru Market", "BooksActually", "Tiong Bahru Bakery", "Yong Siak Street"],
    walkScore: 88,
    transitScore: 85
  }
];

export const rooms = [
  {
    id: 1,
    propertyId: 1,
    roomNumber: "A1",
    roomType: "Master Bedroom",
    priceMonthly: 1000,
    sizeSqm: 18,
    isAvailable: true,
    availableFrom: "2025-07-15",
    amenities: ["Private Bathroom", "Balcony", "Air Conditioning", "Study Desk"],
    images: ["modern_bedroom.jpg"]
  },
  {
    id: 2,
    propertyId: 1,
    roomNumber: "A2",
    roomType: "Standard Room",
    priceMonthly: 900,
    sizeSqm: 15,
    isAvailable: true,
    availableFrom: "2025-08-01",
    amenities: ["Shared Bathroom", "Air Conditioning", "Study Desk"],
    images: ["modern_bedroom.jpg"]
  },
  {
    id: 3,
    propertyId: 1,
    roomNumber: "A3",
    roomType: "Standard Room",
    priceMonthly: 900,
    sizeSqm: 15,
    isAvailable: false,
    amenities: ["Shared Bathroom", "Air Conditioning", "Study Desk"],
    images: ["modern_bedroom.jpg"]
  },
  {
    id: 4,
    propertyId: 2,
    roomNumber: "B1",
    roomType: "Penthouse Suite",
    priceMonthly: 1400,
    sizeSqm: 25,
    isAvailable: true,
    availableFrom: "2025-07-01",
    amenities: ["Private Bathroom", "City View", "Balcony", "Premium Furnishing"],
    images: ["modern_bedroom.jpg"]
  },
  {
    id: 5,
    propertyId: 3,
    roomNumber: "C1",
    roomType: "Standard Room",
    priceMonthly: 1100,
    sizeSqm: 16,
    isAvailable: true,
    availableFrom: "2025-07-10",
    amenities: ["Shared Bathroom", "Air Conditioning", "Study Desk"],
    images: ["modern_bedroom.jpg"]
  }
];

export const occupants = [
  {
    id: 1,
    roomId: 3,
    name: "Sarah Chen",
    age: 24,
    nationality: "Singapore",
    occupation: "Software Engineer",
    moveInDate: "2024-12-01",
    bio: "Tech enthusiast who loves hiking and photography. Always up for exploring new cafes around the city.",
    interests: ["Technology", "Photography", "Hiking", "Coffee"]
  },
  {
    id: 2,
    roomId: 1,
    name: "Marcus Johnson",
    age: 27,
    nationality: "Australia",
    occupation: "Marketing Manager",
    moveInDate: "2024-10-15",
    moveOutDate: "2025-07-14",
    bio: "Digital nomad from Melbourne. Passionate about sustainable living and community building.",
    interests: ["Marketing", "Sustainability", "Travel", "Cooking"]
  },
  {
    id: 3,
    roomId: 2,
    name: "Priya Sharma",
    age: 26,
    nationality: "India",
    occupation: "UX Designer",
    moveInDate: "2025-01-01",
    moveOutDate: "2025-07-31",
    bio: "Creative designer who enjoys yoga and meditation. Always happy to share design tips and healthy recipes.",
    interests: ["Design", "Yoga", "Meditation", "Healthy Living"]
  },
  {
    id: 4,
    roomId: 4,
    name: "David Kim",
    age: 29,
    nationality: "South Korea",
    occupation: "Financial Analyst",
    moveInDate: "2024-11-01",
    bio: "Finance professional who loves gaming and Korean BBQ. Organizing movie nights and game tournaments.",
    interests: ["Finance", "Gaming", "Korean Culture", "Movies"]
  },
  {
    id: 5,
    roomId: 5,
    name: "Emma Thompson",
    age: 25,
    nationality: "United Kingdom",
    occupation: "Content Writer",
    moveInDate: "2024-09-15",
    bio: "Freelance writer and book lover. Always has great recommendations for weekend activities and hidden gems in Singapore.",
    interests: ["Writing", "Literature", "Travel", "Local Culture"]
  }
];

export const neighborhoods = [
  {
    name: "River Valley",
    description: "One of Singapore's most prestigious residential areas, known for its proximity to Orchard Road and the Singapore River. Perfect blend of urban convenience and tranquil living.",
    location: {
      latitude: 1.2966,
      longitude: 103.8449
    },
    highlights: ["Close to Orchard Road", "Riverside dining", "Premium shopping", "Great connectivity"],
    transport: ["Great World MRT", "Orchard MRT", "Multiple bus routes"],
    amenities: ["UE Square", "Great World City", "Robertson Quay", "Clarke Quay"]
  },
  {
    name: "Orchard",
    description: "Singapore's premier shopping and entertainment district. The heart of the city with world-class shopping, dining, and entertainment options.",
    location: {
      latitude: 1.3048,
      longitude: 103.8318
    },
    highlights: ["Shopping paradise", "Fine dining", "Entertainment", "Business district"],
    transport: ["Orchard MRT", "Somerset MRT", "Dhoby Ghaut MRT"],
    amenities: ["ION Orchard", "Takashimaya", "Paragon", "Ngee Ann City"]
  },
  {
    name: "Tiong Bahru",
    description: "Singapore's hippest neighborhood with a perfect blend of heritage charm and modern lifestyle. Known for its art deco architecture and vibrant cafe culture.",
    location: {
      latitude: 1.2859,
      longitude: 103.8267
    },
    highlights: ["Heritage architecture", "Hipster cafes", "Local markets", "Art scene"],
    transport: ["Tiong Bahru MRT", "Outram Park MRT"],
    amenities: ["Tiong Bahru Market", "Independent bookstores", "Art galleries", "Boutique shops"]
  },
  {
    name: "Lentor",
    description: "One of Singapore's greenest and most premium neighborhoods. Quiet residential area with excellent connectivity and proximity to nature.",
    location: {
      latitude: 1.3521,
      longitude: 103.8198
    },
    highlights: ["Green environment", "Premium living", "Quiet neighborhood", "Good connectivity"],
    transport: ["Lentor MRT", "Mayflower MRT"],
    amenities: ["Thomson Nature Park", "Shopping centers", "Local eateries", "Recreation facilities"]
  }
];

