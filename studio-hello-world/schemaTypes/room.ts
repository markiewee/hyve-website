import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'room',
  title: 'Room',
  type: 'document',
  fields: [
    defineField({
      name: 'roomNumber',
      title: 'Room Number',
      type: 'string',
      validation: Rule => Rule.required()
    }),
    defineField({
      name: 'property',
      title: 'Property',
      type: 'reference',
      to: [{type: 'property'}],
      validation: Rule => Rule.required()
    }),
    defineField({
      name: 'roomType',
      title: 'Room Type',
      type: 'string',
      options: {
        list: [
          {title: 'Single Room', value: 'single'},
          {title: 'Master Room', value: 'master'},
          {title: 'Common Room', value: 'common'},
          {title: 'Studio', value: 'studio'},
          {title: 'Shared Room', value: 'shared'}
        ]
      },
      validation: Rule => Rule.required()
    }),
    defineField({
      name: 'priceMonthly',
      title: 'Monthly Price (SGD)',
      type: 'number',
      validation: Rule => Rule.required().min(0)
    }),
    defineField({
      name: 'sizeSqm',
      title: 'Size (sqm)',
      type: 'number',
      validation: Rule => Rule.min(1)
    }),
    defineField({
      name: 'isAvailable',
      title: 'Available',
      type: 'boolean',
      initialValue: true
    }),
    defineField({
      name: 'availableFrom',
      title: 'Available From',
      type: 'date'
    }),
    defineField({
      name: 'images',
      title: 'Room Images',
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
      title: 'Room Amenities',
      type: 'array',
      of: [{type: 'string'}],
      options: {
        layout: 'tags'
      }
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3
    }),
    defineField({
      name: 'floor',
      title: 'Floor',
      type: 'number'
    }),
    defineField({
      name: 'hasPrivateBathroom',
      title: 'Private Bathroom',
      type: 'boolean',
      initialValue: false
    }),
    defineField({
      name: 'hasAircon',
      title: 'Air Conditioning',
      type: 'boolean',
      initialValue: true
    }),
    defineField({
      name: 'furnishingLevel',
      title: 'Furnishing Level',
      type: 'string',
      options: {
        list: [
          {title: 'Fully Furnished', value: 'fully_furnished'},
          {title: 'Partially Furnished', value: 'partially_furnished'},
          {title: 'Unfurnished', value: 'unfurnished'}
        ]
      }
    }),
    defineField({
      name: 'depositMonths',
      title: 'Deposit (months)',
      type: 'number',
      initialValue: 1,
      validation: Rule => Rule.min(0).max(12)
    }),
    defineField({
      name: 'minimumStay',
      title: 'Minimum Stay (months)',
      type: 'number',
      initialValue: 6,
      validation: Rule => Rule.min(1)
    })
  ],
  preview: {
    select: {
      title: 'roomNumber',
      subtitle: 'roomType',
      media: 'images.0.image',
      property: 'property.name'
    },
    prepare({title, subtitle, media, property}) {
      return {
        title: `Room ${title}`,
        subtitle: `${subtitle} at ${property}`,
        media
      }
    }
  }
})