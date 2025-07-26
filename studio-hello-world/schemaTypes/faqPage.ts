import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'faqPage',
  title: 'FAQ Page',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Page Title',
      type: 'string',
      initialValue: 'FAQ Page'
    }),
    defineField({
      name: 'hero',
      title: 'Page Header',
      type: 'object',
      fields: [
        defineField({
          name: 'title',
          title: 'Header Title',
          type: 'string',
          validation: Rule => Rule.required()
        }),
        defineField({
          name: 'subtitle',
          title: 'Header Subtitle',
          type: 'text',
          rows: 3
        })
      ]
    }),
    defineField({
      name: 'faqSections',
      title: 'FAQ Sections',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({
              name: 'sectionTitle',
              title: 'Section Title',
              type: 'string',
              validation: Rule => Rule.required()
            }),
            defineField({
              name: 'questions',
              title: 'Questions',
              type: 'array',
              of: [
                {
                  type: 'object',
                  fields: [
                    defineField({
                      name: 'question',
                      title: 'Question',
                      type: 'string',
                      validation: Rule => Rule.required()
                    }),
                    defineField({
                      name: 'answer',
                      title: 'Answer',
                      type: 'array',
                      of: [
                        {
                          type: 'block',
                          styles: [
                            {title: 'Normal', value: 'normal'},
                            {title: 'H4', value: 'h4'}
                          ],
                          lists: [
                            {title: 'Bullet', value: 'bullet'},
                            {title: 'Number', value: 'number'}
                          ],
                          marks: {
                            decorators: [
                              {title: 'Strong', value: 'strong'},
                              {title: 'Emphasis', value: 'em'}
                            ],
                            annotations: [
                              {
                                title: 'URL',
                                name: 'link',
                                type: 'object',
                                fields: [
                                  {
                                    title: 'URL',
                                    name: 'href',
                                    type: 'url'
                                  }
                                ]
                              }
                            ]
                          }
                        }
                      ]
                    }),
                    defineField({
                      name: 'order',
                      title: 'Display Order',
                      type: 'number',
                      initialValue: 1
                    })
                  ],
                  preview: {
                    select: {
                      title: 'question',
                      subtitle: 'order'
                    },
                    prepare({title, subtitle}) {
                      return {
                        title,
                        subtitle: `Order: ${subtitle}`
                      }
                    }
                  }
                }
              ]
            })
          ],
          preview: {
            select: {
              title: 'sectionTitle',
              subtitle: 'questions'
            },
            prepare({title, subtitle}) {
              const questionCount = subtitle?.length || 0
              return {
                title,
                subtitle: `${questionCount} question${questionCount !== 1 ? 's' : ''}`
              }
            }
          }
        }
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
          name: 'description',
          title: 'CTA Description',
          type: 'text',
          rows: 3
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
        })
      ]
    }),
    defineField({
      name: 'contactInfo',
      title: 'Additional Contact Information',
      type: 'object',
      fields: [
        defineField({
          name: 'title',
          title: 'Contact Section Title',
          type: 'string'
        }),
        defineField({
          name: 'description',
          title: 'Contact Description',
          type: 'text',
          rows: 2
        }),
        defineField({
          name: 'email',
          title: 'Contact Email',
          type: 'email'
        }),
        defineField({
          name: 'phone',
          title: 'Phone Number',
          type: 'string'
        }),
        defineField({
          name: 'whatsapp',
          title: 'WhatsApp Number',
          type: 'string'
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