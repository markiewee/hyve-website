import { createClient } from '@sanity/client'
import imageUrlBuilder from '@sanity/image-url'

export const client = createClient({
  projectId: 'ydn0o1zt',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: true, // Enable CDN for better performance
})

// Helper function for generating image URLs
const builder = imageUrlBuilder(client)

export function urlFor(source) {
  return builder.image(source)
}

// GROQ queries for different content types
export const QUERIES = {
  // Homepage content
  homePage: `*[_type == "homePage"][0]{
    title,
    hero{
      headline,
      subtitle,
      backgroundImage,
      ctaButton
    },
    benefits{
      title,
      subtitle,
      benefitsList[]
    },
    featuredProperties{
      title,
      subtitle,
      showFeaturedOnly,
      maxProperties
    },
    community{
      title,
      description,
      image,
      features[]
    },
    cta{
      title,
      subtitle,
      primaryButton,
      secondaryButton,
      backgroundImage
    }
  }`,

  // All properties (without rooms — use propertiesWithRooms if you need rooms)
  properties: `*[_type == "property"] | order(_createdAt desc){
    _id,
    name,
    slug,
    description,
    address,
    neighborhood->{
      name,
      slug
    },
    location,
    propertyType,
    startingPrice,
    totalRooms,
    availableRooms,
    images[0..2]{
      image,
      alt,
      caption
    },
    amenities,
    nearbyMRT[],
    nearbyAmenities[],
    featured,
    status
  }`,

  // All properties with nested rooms (for pages that need room-level filtering)
  propertiesWithRooms: `*[_type == "property"] | order(_createdAt desc){
    _id,
    name,
    slug,
    description,
    address,
    neighborhood->{
      name,
      slug
    },
    location,
    propertyType,
    startingPrice,
    totalRooms,
    availableRooms,
    images[0..2]{
      image,
      alt,
      caption
    },
    amenities,
    nearbyMRT[],
    nearbyAmenities[],
    featured,
    status,
    "rooms": *[_type == "room" && property._ref == ^._id]{
      _id,
      roomNumber,
      roomType,
      priceMonthly,
      isAvailable,
      availableFrom
    }
  }`,

  // Featured properties (limited to 6 — homepage only shows a few)
  featuredProperties: `*[_type == "property" && featured == true] | order(_createdAt desc)[0..5]{
    _id,
    name,
    slug,
    description,
    address,
    neighborhood->{
      name,
      slug
    },
    startingPrice,
    availableRooms,
    images[0..0]{
      image,
      alt,
      caption
    },
    amenities
  }`,

  // Single property by slug or ID (for detail page)
  propertyDetail: `*[_type == "property" && (slug.current == $id || _id == $id)][0]{
    _id,
    name,
    slug,
    description,
    address,
    neighborhood->{
      name,
      slug,
      description,
      highlights,
      transport,
      amenities
    },
    location,
    propertyType,
    startingPrice,
    totalRooms,
    availableRooms,
    images[]{
      image,
      alt,
      caption
    },
    amenities,
    nearbyMRT[],
    nearbyAmenities[],
    status,
    featured
  }`,

  // Rooms for a specific property
  roomsByProperty: `*[_type == "room" && property._ref == $propertyId]{
    _id,
    roomNumber,
    roomType,
    priceMonthly,
    sizeSqm,
    isAvailable,
    availableFrom,
    images[0..2]{
      image,
      alt
    },
    amenities,
    description,
    hasPrivateBathroom,
    hasAircon,
    furnishingLevel
  }`,

  // Neighborhoods (basic — for dropdowns and filters)
  neighborhoods: `*[_type == "neighborhood" && _id in *[_type == "property"].neighborhood._ref]{
    _id,
    name,
    slug
  } | order(name asc)`,

  // Neighborhoods (full — for locations page)
  neighborhoodsFull: `*[_type == "neighborhood" && _id in *[_type == "property"].neighborhood._ref]{
    _id,
    name,
    slug,
    description,
    location,
    images[0..2]{
      image,
      alt,
      caption
    },
    highlights,
    transport[],
    amenities[],
    demographics,
    priceRange,
    featured
  }`,

  // FAQ page
  faqPage: `*[_type == "faqPage"][0]{
    title,
    hero,
    faqSections[]{
      sectionTitle,
      questions[]{
        question,
        answer,
        order
      }
    },
    cta,
    contactInfo
  }`,
}