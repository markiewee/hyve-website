import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'aboutPage',
  title: 'About Page',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Page Title',
      type: 'string',
      initialValue: 'About Page'
    }),
    defineField({
      name: 'hero',
      title: 'Hero Section',
      type: 'object',
      fields: [
        defineField({
          name: 'title',
          title: 'Hero Title',
          type: 'string',
          validation: Rule => Rule.required()
        }),
        defineField({
          name: 'description',
          title: 'Hero Description',
          type: 'text',
          rows: 4
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
          name: 'awards',
          title: 'Awards/Ratings',
          type: 'array',
          of: [
            {
              type: 'object',
              fields: [
                defineField({
                  name: 'title',
                  title: 'Award Title',
                  type: 'string'
                }),
                defineField({
                  name: 'rating',
                  title: 'Rating',
                  type: 'string'
                }),
                defineField({
                  name: 'source',
                  title: 'Source',
                  type: 'string'
                })
              ]
            }
          ]
        })
      ]
    }),
    defineField({
      name: 'stats',
      title: 'Statistics Section',
      type: 'object',
      fields: [
        defineField({
          name: 'statsItems',
          title: 'Statistics',
          type: 'array',
          of: [
            {
              type: 'object',
              fields: [
                defineField({
                  name: 'number',
                  title: 'Number',
                  type: 'string'
                }),
                defineField({
                  name: 'label',
                  title: 'Label',
                  type: 'string'
                }),
                defineField({
                  name: 'description',
                  title: 'Description',
                  type: 'string'
                })
              ]
            }
          ]
        })
      ]
    }),
    defineField({
      name: 'story',
      title: 'Our Story Section',
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
          type: 'string'
        }),
        defineField({
          name: 'content',
          title: 'Story Content',
          type: 'array',
          of: [
            {
              type: 'block'
            }
          ]
        }),
        defineField({
          name: 'image',
          title: 'Story Image',
          type: 'image',
          options: {
            hotspot: true
          }
        })
      ]
    }),
    defineField({
      name: 'values',
      title: 'Our Values Section',
      type: 'object',
      fields: [
        defineField({
          name: 'title',
          title: 'Section Title',
          type: 'string'
        }),
        defineField({
          name: 'valuesList',
          title: 'Values List',
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
                  title: 'Value Title',
                  type: 'string'
                }),
                defineField({
                  name: 'description',
                  title: 'Value Description',
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
      name: 'team',
      title: 'Team Section',
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
          name: 'teamMembers',
          title: 'Team Members',
          type: 'array',
          of: [
            {
              type: 'object',
              fields: [
                defineField({
                  name: 'name',
                  title: 'Name',
                  type: 'string'
                }),
                defineField({
                  name: 'role',
                  title: 'Role',
                  type: 'string'
                }),
                defineField({
                  name: 'bio',
                  title: 'Bio',
                  type: 'text',
                  rows: 3
                }),
                defineField({
                  name: 'image',
                  title: 'Profile Image',
                  type: 'image',
                  options: {
                    hotspot: true
                  }
                }),
                defineField({
                  name: 'initials',
                  title: 'Initials (fallback)',
                  type: 'string',
                  validation: Rule => Rule.max(3)
                }),
                defineField({
                  name: 'linkedin',
                  title: 'LinkedIn URL',
                  type: 'url'
                }),
                defineField({
                  name: 'email',
                  title: 'Email',
                  type: 'email'
                })
              ]
            }
          ]
        })
      ]
    }),
    defineField({
      name: 'mission',
      title: 'Mission Statement',
      type: 'object',
      fields: [
        defineField({
          name: 'title',
          title: 'Mission Title',
          type: 'string'
        }),
        defineField({
          name: 'quote',
          title: 'Mission Quote',
          type: 'text',
          rows: 4
        }),
        defineField({
          name: 'author',
          title: 'Quote Author',
          type: 'string'
        }),
        defineField({
          name: 'authorRole',
          title: 'Author Role',
          type: 'string'
        })
      ]
    }),
    defineField({
      name: 'awards',
      title: 'Awards & Recognition',
      type: 'object',
      fields: [
        defineField({
          name: 'title',
          title: 'Section Title',
          type: 'string'
        }),
        defineField({
          name: 'awardsList',
          title: 'Awards List',
          type: 'array',
          of: [
            {
              type: 'object',
              fields: [
                defineField({
                  name: 'title',
                  title: 'Award Title',
                  type: 'string'
                }),
                defineField({
                  name: 'description',
                  title: 'Award Description',
                  type: 'text',
                  rows: 2
                }),
                defineField({
                  name: 'icon',
                  title: 'Award Icon',
                  type: 'string',
                  description: 'Icon name or emoji'
                }),
                defineField({
                  name: 'year',
                  title: 'Year Received',
                  type: 'number'
                }),
                defineField({
                  name: 'organization',
                  title: 'Awarding Organization',
                  type: 'string'
                })
              ]
            }
          ]
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
      subtitle: 'hero.title'
    }
  }
})