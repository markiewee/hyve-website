// Static fallback data for Hyve properties.
// Used when Sanity fetch fails or returns null so pages never go blank.
// Structure mirrors the shape returned by the Sanity `propertyDetail` GROQ query
// so the PropertyDetailPageWithSanity component can consume it unchanged.

export const HYVE_FALLBACK_PROPERTIES = {
  'ivory-heights': {
    _id: 'fallback-ivory-heights',
    name: 'Ivory Heights',
    slug: { _type: 'slug', current: 'ivory-heights' },
    description:
      "Whether you're after a spacious private room, a sociable co-living environment, or a well-connected home near Jurong's shopping and transport hubs, Ivory Heights offers a comfortable blend of convenience, community, and space in Singapore's vibrant west.",
    address: '122 Jurong East Street 13',
    neighborhood: {
      name: 'Jurong East',
      slug: { _type: 'slug', current: 'jurong-east' },
      description:
        "Singapore's 2nd CBD — a major commercial and lifestyle hub in the West with extensive shopping malls and proximity to Jurong Lake Gardens.",
    },
    location: { latitude: 1.33556, longitude: 103.73736 },
    propertyType: 'apartment',
    startingPrice: 900,
    totalRooms: 7,
    availableRooms: 1,
    images: [{ alt: 'Ivory Heights exterior' }],
    amenities: ['WiFi', 'Weekly Cleaning', 'Fully Furnished', 'Aircon', 'Utilities Included'],
    nearbyMRT: [{ station: 'Jurong East', line: 'North South / East West', walkingMinutes: 5 }],
    nearbyAmenities: ['Jurong East MRT', 'Westgate', 'JEM', 'IMM', 'Jurong Lake Gardens'],
    status: 'available',
    featured: true,
  },
  'chiltern-park': {
    _id: 'fallback-chiltern-park',
    name: 'Chiltern Park',
    slug: { _type: 'slug', current: 'chiltern-park' },
    description:
      "Whether you're after a comfortable private room, a friendly co-living community, or a peaceful home close to greenery and great amenities, Chiltern Park offers a refreshing balance of space, convenience, and relaxed living in the heart of Serangoon.",
    address: '135 Serangoon Avenue 3',
    neighborhood: {
      name: 'Serangoon',
      slug: { _type: 'slug', current: 'serangoon' },
    },
    location: { latitude: 1.3494, longitude: 103.8733 },
    propertyType: 'apartment',
    startingPrice: 950,
    totalRooms: 6,
    availableRooms: 2,
    images: [{ alt: 'Chiltern Park exterior' }],
    amenities: ['WiFi', 'Weekly Cleaning', 'Fully Furnished', 'Aircon', 'Utilities Included'],
    nearbyMRT: [{ station: 'Serangoon', line: 'NEL / Circle', walkingMinutes: 10 }],
    nearbyAmenities: ['NEX', 'Serangoon MRT', 'Lorong Chuan MRT'],
    status: 'available',
    featured: true,
  },
  'thomson-grove': {
    _id: 'fallback-thomson-grove',
    name: 'Thomson Grove',
    slug: { _type: 'slug', current: 'thomson-grove' },
    description:
      "Whether you're looking for a cozy private room, a welcoming co-living setup, or a tranquil home surrounded by greenery, Thomson Grove offers a peaceful retreat with easy access to nearby eateries, transport links, and the charm of the Thomson area.",
    address: '588 Yio Chu Kang Road',
    neighborhood: { name: 'Thomson', slug: { _type: 'slug', current: 'thomson' } },
    location: { latitude: 1.3795, longitude: 103.8452 },
    propertyType: 'condominium',
    startingPrice: 950,
    totalRooms: 6,
    availableRooms: 2,
    images: [{ alt: 'Thomson Grove exterior' }],
    amenities: ['WiFi', 'Weekly Cleaning', 'Fully Furnished', 'Aircon', 'Utilities Included', 'Pool', 'Gym'],
    nearbyMRT: [{ station: 'Bright Hill', line: 'Thomson-East Coast', walkingMinutes: 7 }],
    nearbyAmenities: ['Thomson Plaza', 'Bright Hill MRT', 'Ai Tong School'],
    status: 'available',
    featured: true,
  },
};

export const HYVE_FALLBACK_ROOMS = {
  'ivory-heights': [
    { _id: 'fb-ih-p1', roomNumber: 'Premium 1', roomType: 'Premium', priceMonthly: 1500, sizeSqm: 20, isAvailable: false, availableFrom: '2026-05-05', amenities: ['WiFi', 'Study Table', 'Double Bed'], hasAircon: true },
    { _id: 'fb-ih-p2', roomNumber: 'Premium 2', roomType: 'Premium', priceMonthly: 1500, sizeSqm: 20, isAvailable: false, availableFrom: '2026-07-12', amenities: ['WiFi', 'Study Table', 'Double Bed'], hasAircon: true },
    { _id: 'fb-ih-p3', roomNumber: 'Premium 3', roomType: 'Premium', priceMonthly: 1600, sizeSqm: 20, isAvailable: true, amenities: ['WiFi', 'Study Table', 'Double Bed'], hasAircon: true },
    { _id: 'fb-ih-s1', roomNumber: 'Standard 1', roomType: 'Standard', priceMonthly: 900, sizeSqm: 15, isAvailable: false, availableFrom: '2026-10-01', amenities: ['WiFi', 'Study Table'], hasAircon: true },
    { _id: 'fb-ih-s2', roomNumber: 'Standard 2', roomType: 'Standard', priceMonthly: 950, sizeSqm: 15, isAvailable: false, availableFrom: '2026-10-01', amenities: ['WiFi', 'Study Table'], hasAircon: true },
    { _id: 'fb-ih-s3', roomNumber: 'Standard 3', roomType: 'Standard', priceMonthly: 1000, sizeSqm: 15, isAvailable: false, availableFrom: '2026-06-20', amenities: ['WiFi', 'Study Table'], hasAircon: true },
    { _id: 'fb-ih-s4', roomNumber: 'Standard 4', roomType: 'Standard', priceMonthly: 1000, sizeSqm: 15, isAvailable: false, availableFrom: '2026-04-20', amenities: ['WiFi', 'Study Table'], hasAircon: true },
  ],
  'chiltern-park': [],
  'thomson-grove': [],
};

// Public-folder image paths used as fallback when Sanity image refs can't be resolved.
export const HYVE_FALLBACK_HERO_IMAGE = {
  'ivory-heights': '/properties/ivory-heights.jpg',
  'chiltern-park': '/properties/chiltern-park.jpg',
  'thomson-grove': '/properties/thomson-grove.jpg',
};
