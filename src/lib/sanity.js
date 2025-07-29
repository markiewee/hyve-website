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
    neighborhood->{
      name,
      slug
    },
    startingPrice,
    availableRooms,
    images[]{
      image,
      alt,
      caption
    },
    amenities
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
  }`,

  // Get all blog posts
  blogPosts: `*[_type == "blogPost" && status == "published"] | order(publishedAt desc){
    _id,
    title,
    slug,
    excerpt,
    content,
    featuredImage,
    category,
    tags,
    author->{
      name,
      role,
      bio,
      avatar
    },
    publishedAt,
    readTime,
    featured
  }`,

  // Get featured blog posts
  featuredBlogPosts: `*[_type == "blogPost" && status == "published" && featured == true] | order(publishedAt desc){
    _id,
    title,
    slug,
    excerpt,
    featuredImage,
    category,
    tags,
    author->{
      name,
      role
    },
    publishedAt,
    readTime
  }`,

  // Get single blog post by slug
  blogPostBySlug: `*[_type == "blogPost" && slug.current == $slug && status == "published"][0]{
    _id,
    title,
    slug,
    excerpt,
    content,
    featuredImage,
    category,
    tags,
    author->{
      name,
      role,
      bio,
      avatar,
      socialMedia
    },
    publishedAt,
    readTime,
    seo
  }`,

  // Get authors
  authors: `*[_type == "author" && status == "active"]{
    _id,
    name,
    slug,
    role,
    bio,
    avatar,
    featured
  }`
}