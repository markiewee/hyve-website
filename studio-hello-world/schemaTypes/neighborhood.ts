import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'neighborhood',
  title: 'Neighborhood',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Neighborhood Name',
      type: 'string',
      validation: Rule => Rule.required()
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'name',
        maxLength: 96
      },
      validation: Rule => Rule.required()
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 4
    }),
    defineField({
      name: 'location',
      title: 'Location',
      type: 'object',
      fields: [
        defineField({
          name: 'latitude',
          title: 'Latitude',
          type: 'number',
          validation: Rule => Rule.min(-90).max(90)
        }),
        defineField({
          name: 'longitude',
          title: 'Longitude',
          type: 'number',
          validation: Rule => Rule.min(-180).max(180)
        })
      ]
    }),
    defineField({
      name: 'images',
      title: 'Neighborhood Images',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({
              name: 'image',
              title: 'Image',
              type: 'image',
              options: {
                hotspot: true
              }
            }),
            defineField({
              name: 'alt',
              title: 'Alt Text',
              type: 'string'
            }),
            defineField({
              name: 'caption',
              title: 'Caption',
              type: 'string'
            })
          ]
        }
      ]
    }),
    defineField({
      name: 'highlights',
      title: 'Neighborhood Highlights',
      type: 'array',
      of: [{type: 'string'}],
      options: {
        layout: 'tags'
      }
    }),
    defineField({
      name: 'transport',
      title: 'Transportation Options',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({
              name: 'type',
              title: 'Transport Type',
              type: 'string',
              options: {
                list: [
                  {title: 'MRT', value: 'mrt'},
                  {title: 'Bus', value: 'bus'},
                  {title: 'Taxi', value: 'taxi'},
                  {title: 'Bike Share', value: 'bike'},
                  {title: 'Walking', value: 'walking'}
                ]
              }
            }),
            defineField({
              name: 'description',
              title: 'Description',
              type: 'string'
            }),
            defineField({
              name: 'accessibility',
              title: 'Accessibility Rating',
              type: 'string',
              options: {
                list: [
                  {title: 'Excellent', value: 'excellent'},
                  {title: 'Good', value: 'good'},
                  {title: 'Fair', value: 'fair'},
                  {title: 'Limited', value: 'limited'}
                ]
              }
            })
          ]
        }
      ]
    }),
    defineField({
      name: 'amenities',
      title: 'Local Amenities',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({
              name: 'name',
              title: 'Amenity Name',
              type: 'string'
            }),
            defineField({
              name: 'type',
              title: 'Amenity Type',
              type: 'string',
              options: {
                list: [
                  {title: 'Shopping Mall', value: 'mall'},
                  {title: 'Grocery Store', value: 'grocery'},
                  {title: 'Restaurant', value: 'restaurant'},
                  {title: 'Coffee Shop', value: 'cafe'},
                  {title: 'Gym/Fitness', value: 'gym'},
                  {title: 'Park', value: 'park'},
                  {title: 'Hospital/Clinic', value: 'medical'},
                  {title: 'School', value: 'education'},
                  {title: 'Bank', value: 'bank'},
                  {title: 'Entertainment', value: 'entertainment'},
                  {title: 'Other', value: 'other'}
                ]
              }
            }),
            defineField({
              name: 'walkingMinutes',
              title: 'Walking Time (minutes)',
              type: 'number'
            }),
            defineField({
              name: 'description',
              title: 'Description',
              type: 'string'
            })
          ]
        }
      ]
    }),
    defineField({
      name: 'demographics',
      title: 'Demographics & Vibe',
      type: 'object',
      fields: [
        defineField({
          name: 'vibe',
          title: 'Neighborhood Vibe',
          type: 'array',
          of: [{type: 'string'}],
          options: {
            list: [
              {title: 'Business District', value: 'business'},
              {title: 'Trendy & Hip', value: 'trendy'},
              {title: 'Family-Friendly', value: 'family'},
              {title: 'Nightlife Hub', value: 'nightlife'},
              {title: 'Cultural District', value: 'cultural'},
              {title: 'Shopping Paradise', value: 'shopping'},
              {title: 'Food Haven', value: 'food'},
              {title: 'Quiet Residential', value: 'quiet'},
              {title: 'Expat Community', value: 'expat'},
              {title: 'Local Heritage', value: 'heritage'}
            ]
          }
        }),
        defineField({
          name: 'ageGroup',
          title: 'Popular Age Groups',
          type: 'array',
          of: [{type: 'string'}],
          options: {
            list: [
              {title: 'Young Professionals (25-35)', value: 'young_professionals'},
              {title: 'Students', value: 'students'},
              {title: 'Families', value: 'families'},
              {title: 'Expats', value: 'expats'},
              {title: 'Seniors', value: 'seniors'}
            ]
          }
        })
      ]
    }),
    defineField({
      name: 'priceRange',
      title: 'Price Range',
      type: 'object',
      fields: [
        defineField({
          name: 'category',
          title: 'Price Category',
          type: 'string',
          options: {
            list: [
              {title: 'Budget-Friendly', value: 'budget'},
              {title: 'Mid-Range', value: 'mid'},
              {title: 'Premium', value: 'premium'},
              {title: 'Luxury', value: 'luxury'}
            ]
          }
        }),
        defineField({
          name: 'rentRange',
          title: 'Typical Rent Range',
          type: 'string',
          description: 'e.g., SGD 800-1500/month'
        })
      ]
    }),
    defineField({
      name: 'featured',
      title: 'Featured Neighborhood',
      type: 'boolean',
      initialValue: false
    })
  ],
  preview: {
    select: {
      title: 'name',
      subtitle: 'description',
      media: 'images.0.image'
    }
  }
})