# Hyve Website

A modern React-based website for Hyve co-living spaces in Singapore, featuring property listings, location details, and an interactive user experience.

## Features

- **Property Listings**: Browse available co-living spaces with detailed information
- **Interactive Search**: Filter properties by location, price range, and room type
- **Location Pages**: Explore different neighborhoods and areas
- **Property Details**: View comprehensive information about each property including rooms, amenities, and pricing
- **Responsive Design**: Optimized for desktop and mobile devices
- **Modern UI**: Built with Tailwind CSS and Radix UI components

## Tech Stack

- **Frontend**: React 19.1.0 with Vite
- **Routing**: React Router DOM
- **Styling**: Tailwind CSS 4.1.7
- **UI Components**: Radix UI primitives
- **Icons**: Lucide React
- **Animation**: Framer Motion
- **Forms**: React Hook Form with Zod validation
- **Deployment**: Vercel with serverless API functions

## Project Structure

```
src/
├── components/
│   ├── ui/           # Reusable UI components (buttons, cards, etc.)
│   ├── HomePage.jsx  # Landing page with hero section
│   ├── PropertiesPage.jsx  # Property listings page
│   ├── PropertyDetailPage.jsx  # Individual property details
│   ├── LocationsPage.jsx  # Location information
│   ├── AboutPage.jsx  # About page
│   ├── FAQsPage.jsx  # Frequently asked questions
│   └── Navbar.jsx    # Navigation component
├── services/
│   └── api.js        # API service layer
├── data/
│   └── sampleData.js # Sample property data
├── assets/           # Images and static assets
└── hooks/            # Custom React hooks

api/
├── properties.js     # Properties API endpoint
├── rooms.js          # Rooms API endpoint
└── property/         # Property-specific API routes
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Start the development server:
   ```bash
   pnpm dev
   ```

4. Open [http://localhost:5173](http://localhost:5173) in your browser

### Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build
- `pnpm lint` - Run ESLint

## API Endpoints

The project includes Vercel serverless functions for:

- `/api/properties` - Get all properties
- `/api/property/[id]` - Get specific property details
- `/api/property/[id]/rooms` - Get rooms for a property
- `/api/rooms` - Get all rooms

## Key Features

### Property Search
- Filter by location, price range, and availability
- Real-time search functionality
- Property cards with images and key details

### Property Details
- Comprehensive property information
- Room availability and pricing
- Amenities and neighborhood details
- Image galleries

### Responsive Design
- Mobile-first approach
- Optimized for all screen sizes
- Touch-friendly interactions

## Deployment

The project is configured for deployment on Vercel:

1. Push to your Git repository
2. Connect to Vercel
3. Deploy automatically on push

The `vercel.json` file includes CORS configuration for API routes.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is private and proprietary.