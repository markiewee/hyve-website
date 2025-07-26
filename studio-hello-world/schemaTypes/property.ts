import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'property',
  title: 'Property',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Property Name',
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
      name: 'address',
      title: 'Address',
      type: 'string',
      validation: Rule => Rule.required()
    }),
    defineField({
      name: 'neighborhood',
      title: 'Neighborhood',
      type: 'reference',
      to: [{type: 'neighborhood'}]
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
      name: 'propertyType',
      title: 'Property Type',
      type: 'string',
      options: {
        list: [
          {title: 'Apartment', value: 'apartment'},
          {title: 'House', value: 'house'},
          {title: 'Studio', value: 'studio'},
          {title: 'Coliving Space', value: 'coliving'}
        ]
      }
    }),
    defineField({
      name: 'startingPrice',
      title: 'Starting Price (SGD)',
      type: 'number',
      validation: Rule => Rule.min(0)
    }),
    defineField({
      name: 'totalRooms',
      title: 'Total Rooms',
      type: 'number',
      validation: Rule => Rule.min(1)
    }),
    defineField({
      name: 'availableRooms',
      title: 'Available Rooms',
      type: 'number',
      validation: Rule => Rule.min(0)
    }),
    defineField({
      name: 'images',
      title: 'Property Images',
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
      name: 'amenities',
      title: 'Amenities',
      type: 'array',
      of: [{type: 'string'}],
      options: {
        layout: 'tags'
      }
    }),
    defineField({
      name: 'nearbyMRT',
      title: 'Nearby MRT Stations',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({
              name: 'station',
              title: 'Station Name',
              type: 'string'
            }),
            defineField({
              name: 'walkingMinutes',
              title: 'Walking Time (minutes)',
              type: 'number'
            }),
            defineField({
              name: 'line',
              title: 'MRT Line',
              type: 'string'
            })
          ]
        }
      ]
    }),
    defineField({
      name: 'nearbyAmenities',
      title: 'Nearby Amenities',
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
              title: 'Type',
              type: 'string',
              options: {
                list: [
                  {title: 'Grocery Store', value: 'grocery'},
                  {title: 'Restaurant', value: 'restaurant'},
                  {title: 'Gym', value: 'gym'},
                  {title: 'Shopping Mall', value: 'mall'},
                  {title: 'Hospital', value: 'hospital'},
                  {title: 'School', value: 'school'},
                  {title: 'Bank', value: 'bank'},
                  {title: 'Other', value: 'other'}
                ]
              }
            }),
            defineField({
              name: 'walkingMinutes',
              title: 'Walking Time (minutes)',
              type: 'number'
            })
          ]
        }
      ]
    }),
    defineField({
      name: 'walkScore',
      title: 'Walk Score',
      type: 'number',
      validation: Rule => Rule.min(0).max(100)
    }),
    defineField({
      name: 'transitScore',
      title: 'Transit Score',
      type: 'number',
      validation: Rule => Rule.min(0).max(100)
    }),
    defineField({
      name: 'featured',
      title: 'Featured Property',
      type: 'boolean',
      initialValue: false
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          {title: 'Available', value: 'available'},
          {title: 'Coming Soon', value: 'coming_soon'},
          {title: 'Fully Occupied', value: 'full'}
        ]
      },
      initialValue: 'available'
    })
  ],
  preview: {
    select: {
      title: 'name',
      subtitle: 'address',
      media: 'images.0.image'
    }
  }
})