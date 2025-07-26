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
  // Get homepage content
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

  // Get all properties
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
    images[]{
      image,
      alt,
      caption
    },
    amenities,
    nearbyMRT[],
    nearbyAmenities[],
    walkScore,
    transitScore,
    featured,
    status
  }`,

  // Get featured properties only
  featuredProperties: `*[_type == "property" && featured == true] | order(_createdAt desc){
    _id,
    name,
    slug,
    description,
    address,
    startingPrice,
    images[0]{
      image,
      alt
    },
    amenities[0...3]
  }`,

  // Get single property by slug
  propertyBySlug: `*[_type == "property" && slug.current == $slug][0]{
    _id,
    name,
    description,
    address,
    neighborhood->{
      name,
      slug,
      description,
      highlights
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
    walkScore,
    transitScore,
    status
  }`,

  // Get rooms for a property
  roomsByProperty: `*[_type == "room" && property._ref == $propertyId]{
    _id,
    roomNumber,
    roomType,
    priceMonthly,
    sizeSqm,
    isAvailable,
    availableFrom,
    images[]{
      image,
      alt
    },
    amenities,
    description,
    hasPrivateBathroom,
    hasAircon,
    furnishingLevel
  }`,

  // Get about page content
  aboutPage: `*[_type == "aboutPage"][0]{
    title,
    hero,
    stats,
    story,
    values,
    team,
    mission,
    awards
  }`,

  // Get FAQ page content
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

  // Get site settings
  siteSettings: `*[_type == "siteSettings"][0]{
    title,
    description,
    logo,
    navigation,
    contact,
    socialMedia,
    footer,
    seo
  }`
}