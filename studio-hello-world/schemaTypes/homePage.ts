import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'homePage',
  title: 'Home Page',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Page Title',
      type: 'string',
      initialValue: 'Home Page'
    }),
    defineField({
      name: 'hero',
      title: 'Hero Section',
      type: 'object',
      fields: [
        defineField({
          name: 'headline',
          title: 'Main Headline',
          type: 'string',
          validation: Rule => Rule.required()
        }),
        defineField({
          name: 'subtitle',
          title: 'Subtitle',
          type: 'text',
          rows: 2
        }),
        defineField({
          name: 'backgroundImage',
          title: 'Background Image',
          type: 'image',
          options: {
            hotspot: true
          }
        }),
        defineField({
          name: 'ctaButton',
          title: 'CTA Button',
          type: 'object',
          fields: [
            defineField({
              name: 'text',
              title: 'Button Text',
              type: 'string'
            }),
            defineField({
              name: 'link',
              title: 'Button Link',
              type: 'string'
            })
          ]
        })
      ]
    }),
    defineField({
      name: 'benefits',
      title: 'Benefits Section',
      type: 'object',
      fields: [
        defineField({
          name: 'title',
          title: 'Section Title',
          type: 'string'
        }),
        defineField({
          name: 'subtitle',
          title: 'Section Subtitle',
          type: 'text',
          rows: 2
        }),
        defineField({
          name: 'benefitsList',
          title: 'Benefits List',
          type: 'array',
          of: [
            {
              type: 'object',
              fields: [
                defineField({
                  name: 'icon',
                  title: 'Icon',
                  type: 'string',
                  description: 'Icon name or emoji'
                }),
                defineField({
                  name: 'title',
                  title: 'Benefit Title',
                  type: 'string'
                }),
                defineField({
                  name: 'description',
                  title: 'Description',
                  type: 'text',
                  rows: 3
                })
              ]
            }
          ]
        })
      ]
    }),
    defineField({
      name: 'featuredProperties',
      title: 'Featured Properties Section',
      type: 'object',
      fields: [
        defineField({
          name: 'title',
          title: 'Section Title',
          type: 'string'
        }),
        defineField({
          name: 'subtitle',
          title: 'Section Subtitle',
          type: 'text',
          rows: 2
        }),
        defineField({
          name: 'showFeaturedOnly',
          title: 'Show Only Featured Properties',
          type: 'boolean',
          initialValue: true
        }),
        defineField({
          name: 'maxProperties',
          title: 'Maximum Properties to Show',
          type: 'number',
          initialValue: 6,
          validation: Rule => Rule.min(1).max(12)
        })
      ]
    }),
    defineField({
      name: 'community',
      title: 'Community Section',
      type: 'object',
      fields: [
        defineField({
          name: 'title',
          title: 'Section Title',
          type: 'string'
        }),
        defineField({
          name: 'description',
          title: 'Description',
          type: 'text',
          rows: 4
        }),
        defineField({
          name: 'image',
          title: 'Community Image',
          type: 'image',
          options: {
            hotspot: true
          }
        }),
        defineField({
          name: 'features',
          title: 'Community Features',
          type: 'array',
          of: [
            {
              type: 'object',
              fields: [
                defineField({
                  name: 'feature',
                  title: 'Feature',
                  type: 'string'
                }),
                defineField({
                  name: 'description',
                  title: 'Feature Description',
                  type: 'text',
                  rows: 2
                })
              ]
            }
          ]
        })
      ]
    }),
    defineField({
      name: 'cta',
      title: 'Call to Action Section',
      type: 'object',
      fields: [
        defineField({
          name: 'title',
          title: 'CTA Title',
          type: 'string'
        }),
        defineField({
          name: 'subtitle',
          title: 'CTA Subtitle',
          type: 'text',
          rows: 2
        }),
        defineField({
          name: 'primaryButton',
          title: 'Primary Button',
          type: 'object',
          fields: [
            defineField({
              name: 'text',
              title: 'Button Text',
              type: 'string'
            }),
            defineField({
              name: 'link',
              title: 'Button Link',
              type: 'string'
            })
          ]
        }),
        defineField({
          name: 'secondaryButton',
          title: 'Secondary Button',
          type: 'object',
          fields: [
            defineField({
              name: 'text',
              title: 'Button Text',
              type: 'string'
            }),
            defineField({
              name: 'link',
              title: 'Button Link',
              type: 'string'
            })
          ]
        }),
        defineField({
          name: 'backgroundImage',
          title: 'Background Image',
          type: 'image',
          options: {
            hotspot: true
          }
        })
      ]
    }),
    defineField({
      name: 'seo',
      title: 'SEO',
      type: 'object',
      fields: [
        defineField({
          name: 'metaTitle',
          title: 'Meta Title',
          type: 'string',
          validation: Rule => Rule.max(60)
        }),
        defineField({
          name: 'metaDescription',
          title: 'Meta Description',
          type: 'text',
          rows: 3,
          validation: Rule => Rule.max(160)
        }),
        defineField({
          name: 'ogImage',
          title: 'Open Graph Image',
          type: 'image'
        })
      ]
    })
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'hero.headline'
    }
  }
})