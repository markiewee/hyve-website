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
    images: ["hero_coliving_interior.jpg", "stock_apart1.png", "modern_coliving_space.jpg"],
    startingPrice: 900,
    availableRooms: 2,
    nearbyMRT: ["Lentor MRT (5 min walk)", "Mayflower MRT (8 min walk)"],
    nearbyAmenities: ["Thomson Plaza", "Yishun Park", "Lower Seletar Reservoir"]
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
    images: ["river_valley_exterior.jpg", "stock_apart2.png", "shared_kitchen.jpg"],
    startingPrice: 1200,
    availableRooms: 1,
    nearbyMRT: ["Great World MRT (3 min walk)", "Orchard MRT (10 min walk)"],
    nearbyAmenities: ["Great World City", "UE Square", "Robertson Quay", "Clarke Quay"]
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
    images: ["orchard_building.jpg", "stock_apart1.png", "singapore_apartment_living.jpg"],
    startingPrice: 1100,
    availableRooms: 3,
    nearbyMRT: ["Orchard MRT (2 min walk)", "Somerset MRT (5 min walk)"],
    nearbyAmenities: ["ION Orchard", "Takashimaya", "Paragon", "Ngee Ann City"]
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
    images: ["tiong_bahru_neighborhood.jpg", "stock_apart2.png", "shared_kitchen.jpg"],
    startingPrice: 950,
    availableRooms: 2,
    nearbyMRT: ["Tiong Bahru MRT (3 min walk)", "Outram Park MRT (8 min walk)"],
    nearbyAmenities: ["Tiong Bahru Market", "BooksActually", "Tiong Bahru Bakery", "Yong Siak Street"]
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
    images: ["modern_bedroom.jpg", "stock_apart1.png"]
  },
  {
    id: 2,
    propertyId: 1,
    roomNumber: "A2",
    roomType: "Standard Room",
    priceMonthly: 900,
    sizeSqm: 15,
    isAvailable: false,
    availableFrom: "2025-02-15",
    amenities: ["Shared Bathroom", "Air Conditioning", "Study Desk"],
    images: ["modern_bedroom.jpg", "stock_apart1.png"]
  },
  {
    id: 3,
    propertyId: 1,
    roomNumber: "A3",
    roomType: "Standard Room",
    priceMonthly: 900,
    sizeSqm: 15,
    isAvailable: false,
    availableFrom: "2025-03-01",
    amenities: ["Shared Bathroom", "Air Conditioning", "Study Desk"],
    images: ["modern_bedroom.jpg", "stock_apart1.png"]
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
    images: ["modern_bedroom.jpg", "stock_apart1.png"]
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
    images: ["modern_bedroom.jpg", "stock_apart1.png"]
  },
  {
    id: 6,
    propertyId: 1,
    roomNumber: "A5",
    roomType: "Double Room",
    priceMonthly: 1300,
    sizeSqm: 22,
    isAvailable: true,
    availableFrom: "2025-01-15",
    amenities: ["Shared Bathroom", "Double Bed", "Study Desk", "Air Conditioning", "Large Window"],
    images: ["modern_bedroom.jpg", "stock_apart1.png"]
  },
  {
    id: 7,
    propertyId: 2,
    roomNumber: "B4",
    roomType: "Double Room",
    priceMonthly: 1600,
    sizeSqm: 26,
    isAvailable: false,
    availableFrom: "2025-03-10",
    amenities: ["Private Bathroom", "Double Bed", "Study Desk", "Air Conditioning", "City View", "Balcony"],
    images: ["modern_bedroom.jpg", "stock_apart2.png"]
  },
  {
    id: 8,
    propertyId: 3,
    roomNumber: "C3",
    roomType: "Double Room",
    priceMonthly: 1450,
    sizeSqm: 24,
    isAvailable: true,
    availableFrom: "2025-02-01",
    amenities: ["Shared Bathroom", "Double Bed", "Study Desk", "Air Conditioning", "Garden View"],
    images: ["modern_bedroom.jpg", "stock_apart1.png"]
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

export const blogPosts = [
  {
    id: 1,
    title: "The Ultimate Guide to Coliving in Singapore",
    slug: "ultimate-guide-coliving-singapore",
    excerpt: "Everything you need to know about finding, choosing, and thriving in Singapore's coliving spaces.",
    content: `Singapore's coliving scene has exploded in recent years, offering young professionals and digital nomads an affordable and community-focused way to live in one of the world's most expensive cities.

## What is Coliving?

Coliving is a modern approach to living that combines private bedrooms with shared common spaces. Unlike traditional flat-sharing, coliving spaces are professionally managed and designed to foster community connections.

## Benefits of Coliving in Singapore

### Cost-Effective Living
- All-inclusive rent covering utilities, WiFi, and cleaning
- No need for large security deposits or furniture purchases
- Flexible lease terms from 3 months

### Built-in Community
- Regular social events and networking opportunities
- Like-minded residents from diverse backgrounds
- Professional community management

### Prime Locations
- Properties in central neighborhoods
- Easy access to MRT stations and amenities
- Walk to work opportunities in CBD areas

## How to Choose the Right Coliving Space

1. **Location**: Consider your work commute and lifestyle preferences
2. **Community**: Look for spaces with residents who share your interests
3. **Amenities**: Check what's included in your rent
4. **Management**: Professional management makes all the difference

Ready to start your coliving journey? Explore our properties across Singapore's most vibrant neighborhoods.`,
    author: "Sarah Chen",
    authorRole: "Community Manager",
    publishedAt: "2025-01-15",
    readTime: 8,
    tags: ["Coliving", "Singapore", "Guide"],
    featuredImage: "/stock_apart1.png",
    category: "Guides"
  },
  {
    id: 2,
    title: "Best Neighborhoods for Young Professionals in Singapore",
    slug: "best-neighborhoods-young-professionals-singapore",
    excerpt: "Discover the top areas in Singapore that offer the perfect blend of work, life, and play for young professionals.",
    content: `Singapore offers diverse neighborhoods, each with its unique character and advantages for young professionals. Here's our guide to the best areas to call home.

## River Valley: Urban Sophistication

River Valley consistently ranks as one of Singapore's most desirable neighborhoods for young professionals.

### Why Choose River Valley?
- **Proximity to CBD**: 15-minute commute to the financial district
- **Dining Scene**: World-class restaurants along Robertson Quay
- **Transportation**: Multiple MRT lines and bus connections
- **Lifestyle**: Perfect blend of urban convenience and riverside tranquility

## Orchard: Right in the Heart of It All

Living in Orchard means being at the center of Singapore's retail and business hub.

### Orchard Advantages:
- **Shopping**: World-class malls at your doorstep
- **Networking**: Close to major corporate offices
- **Entertainment**: Cinemas, bars, and cultural venues
- **Convenience**: Everything you need within walking distance

## Tiong Bahru: The Creative Quarter

For professionals in creative industries, Tiong Bahru offers an inspiring environment.

### Creative Professional Benefits:
- **Art Scene**: Galleries, independent bookstores, and creative spaces
- **Cafe Culture**: Perfect for remote work and networking
- **Heritage Charm**: Beautiful Art Deco architecture
- **Community**: Tight-knit neighborhood feel

## Making Your Choice

Consider these factors when choosing your neighborhood:
1. Commute time to your office
2. Lifestyle preferences (nightlife vs. quiet living)
3. Budget considerations
4. Access to amenities important to you

Each neighborhood offers unique advantages - the key is finding the one that aligns with your professional goals and personal preferences.`,
    author: "Marcus Johnson",
    authorRole: "Area Specialist",
    publishedAt: "2025-01-12",
    readTime: 6,
    tags: ["Neighborhoods", "Professionals", "Lifestyle"],
    featuredImage: "/stock_apart2.png",
    category: "Lifestyle"
  },
  {
    id: 3,
    title: "5 Tips for Building Community in Your Coliving Space",
    slug: "building-community-coliving-space-tips",
    excerpt: "Learn how to make meaningful connections and create lasting friendships in your coliving environment.",
    content: `One of the biggest advantages of coliving is the built-in community, but meaningful connections don't happen automatically. Here are our top tips for building strong relationships in your coliving space.

## 1. Be Proactive in Common Areas

Don't just retreat to your room after work. Spend time in shared spaces where natural interactions happen.

### Ways to Be Present:
- Cook dinner in the shared kitchen
- Work from the common area occasionally
- Watch movies in the living room
- Use shared amenities like the gym or rooftop

## 2. Organize or Join Group Activities

Take initiative in creating shared experiences that bring residents together.

### Activity Ideas:
- Weekly dinner parties
- Movie nights
- Workout sessions
- Game tournaments
- Cultural exchange events

## 3. Respect Shared Spaces

Good community starts with being a considerate housemate.

### Community Guidelines:
- Clean up after yourself immediately
- Be mindful of noise levels
- Share common resources fairly
- Communicate openly about any issues

## 4. Embrace Cultural Diversity

Coliving spaces often house residents from various countries and backgrounds.

### Ways to Connect:
- Share your cultural traditions
- Try foods from different cultures
- Learn basic phrases in other languages
- Attend cultural celebrations

## 5. Use Technology to Stay Connected

Many coliving spaces have resident groups or apps to facilitate communication.

### Digital Community Building:
- Join WhatsApp or Slack groups
- Share resources and recommendations
- Coordinate group activities
- Stay updated on community events

Remember, building community takes time and effort from everyone. Be patient, stay open-minded, and don't be afraid to make the first move in forming new friendships.`,
    author: "Priya Sharma",
    authorRole: "Resident Experience Coordinator",
    publishedAt: "2025-01-10",
    readTime: 5,
    tags: ["Community", "Tips", "Social"],
    featuredImage: "/stock_apart1.png",
    category: "Community"
  },
  {
    id: 4,
    title: "Working from Home in a Coliving Space: A Complete Guide",
    slug: "working-from-home-coliving-space-guide",
    excerpt: "Master the art of remote work while living in a shared coliving environment with these practical tips.",
    content: `The rise of remote work has made coliving an even more attractive option for digital nomads and remote workers. Here's how to create the perfect work-life balance in a shared living environment.

## Creating Your Workspace

Even in a coliving environment, having a dedicated workspace is crucial for productivity.

### In Your Private Room:
- **Desk Setup**: Invest in a good desk and ergonomic chair
- **Lighting**: Ensure adequate lighting for video calls
- **Storage**: Keep work materials organized and separate
- **Noise Control**: Use noise-canceling headphones

### Utilizing Common Areas:
- **Kitchen Counter**: Great for standing meetings
- **Living Room**: Comfortable seating for creative work
- **Rooftop/Balcony**: Fresh air and natural light
- **Study Rooms**: Many coliving spaces offer dedicated work areas

## Managing Noise and Distractions

Shared living comes with its challenges when you're trying to focus.

### Noise Management Strategies:
- Communicate your schedule with housemates
- Use white noise apps or background music
- Schedule important calls during quieter hours
- Create "do not disturb" signals

## Building Professional Relationships

Your coliving space can become a valuable networking hub.

### Professional Networking:
- Host informal industry meetups
- Share professional resources and opportunities
- Collaborate on projects with skilled housemates
- Exchange referrals and recommendations

## Maintaining Work-Life Balance

Living and working in the same space requires clear boundaries.

### Balance Strategies:
- Set fixed working hours
- Take lunch breaks away from your workspace
- Join housemates for evening activities
- Use weekends for social and personal time

## Technology and Infrastructure

Ensure your coliving space supports your professional needs.

### Essential Requirements:
- High-speed, reliable internet
- Backup internet options (mobile hotspot)
- Sufficient power outlets
- Good mobile coverage for calls

## Creating Professional Video Call Backgrounds

Your room setup should be video-call ready at all times.

### Professional Setup Tips:
- Position your camera at eye level
- Use good lighting (natural light works best)
- Keep a clean, uncluttered background
- Test your setup before important calls

Working from a coliving space offers unique advantages - embrace the community while maintaining your professional standards.`,
    author: "David Kim",
    authorRole: "Remote Work Consultant",
    publishedAt: "2025-01-08",
    readTime: 7,
    tags: ["Remote Work", "Productivity", "Coliving"],
    featuredImage: "/stock_apart2.png",
    category: "Work"
  }
];

