import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'siteSettings',
  title: 'Site Settings',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Site Title',
      type: 'string',
      validation: Rule => Rule.required()
    }),
    defineField({
      name: 'description',
      title: 'Site Description',
      type: 'text',
      rows: 3
    }),
    defineField({
      name: 'logo',
      title: 'Site Logo',
      type: 'image',
      options: {
        hotspot: true
      }
    }),
    defineField({
      name: 'favicon',
      title: 'Favicon',
      type: 'image'
    }),
    defineField({
      name: 'navigation',
      title: 'Navigation',
      type: 'object',
      fields: [
        defineField({
          name: 'mainMenu',
          title: 'Main Menu Items',
          type: 'array',
          of: [
            {
              type: 'object',
              fields: [
                defineField({
                  name: 'title',
                  title: 'Menu Title',
                  type: 'string'
                }),
                defineField({
                  name: 'url',
                  title: 'URL',
                  type: 'string'
                }),
                defineField({
                  name: 'openInNewTab',
                  title: 'Open in New Tab',
                  type: 'boolean',
                  initialValue: false
                })
              ]
            }
          ]
        }),
        defineField({
          name: 'ctaButton',
          title: 'Navigation CTA Button',
          type: 'object',
          fields: [
            defineField({
              name: 'text',
              title: 'Button Text',
              type: 'string'
            }),
            defineField({
              name: 'url',
              title: 'Button URL',
              type: 'string'
            }),
            defineField({
              name: 'style',
              title: 'Button Style',
              type: 'string',
              options: {
                list: [
                  {title: 'Primary', value: 'primary'},
                  {title: 'Secondary', value: 'secondary'},
                  {title: 'Outline', value: 'outline'}
                ]
              }
            })
          ]
        })
      ]
    }),
    defineField({
      name: 'contact',
      title: 'Contact Information',
      type: 'object',
      fields: [
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
        }),
        defineField({
          name: 'address',
          title: 'Business Address',
          type: 'text',
          rows: 3
        }),
        defineField({
          name: 'businessHours',
          title: 'Business Hours',
          type: 'string'
        })
      ]
    }),
    defineField({
      name: 'socialMedia',
      title: 'Social Media Links',
      type: 'object',
      fields: [
        defineField({
          name: 'facebook',
          title: 'Facebook URL',
          type: 'url'
        }),
        defineField({
          name: 'instagram',
          title: 'Instagram URL',
          type: 'url'
        }),
        defineField({
          name: 'twitter',
          title: 'Twitter URL',
          type: 'url'
        }),
        defineField({
          name: 'linkedin',
          title: 'LinkedIn URL',
          type: 'url'
        }),
        defineField({
          name: 'youtube',
          title: 'YouTube URL',
          type: 'url'
        }),
        defineField({
          name: 'tiktok',
          title: 'TikTok URL',
          type: 'url'
        })
      ]
    }),
    defineField({
      name: 'footer',
      title: 'Footer Settings',
      type: 'object',
      fields: [
        defineField({
          name: 'copyrightText',
          title: 'Copyright Text',
          type: 'string'
        }),
        defineField({
          name: 'footerMenu',
          title: 'Footer Menu',
          type: 'array',
          of: [
            {
              type: 'object',
              fields: [
                defineField({
                  name: 'title',
                  title: 'Menu Title',
                  type: 'string'
                }),
                defineField({
                  name: 'url',
                  title: 'URL',
                  type: 'string'
                })
              ]
            }
          ]
        }),
        defineField({
          name: 'legalPages',
          title: 'Legal Pages',
          type: 'array',
          of: [
            {
              type: 'object',
              fields: [
                defineField({
                  name: 'title',
                  title: 'Page Title',
                  type: 'string'
                }),
                defineField({
                  name: 'url',
                  title: 'URL',
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
      title: 'Default SEO Settings',
      type: 'object',
      fields: [
        defineField({
          name: 'metaTitle',
          title: 'Default Meta Title',
          type: 'string',
          validation: Rule => Rule.max(60)
        }),
        defineField({
          name: 'metaDescription',
          title: 'Default Meta Description',
          type: 'text',
          rows: 3,
          validation: Rule => Rule.max(160)
        }),
        defineField({
          name: 'ogImage',
          title: 'Default Open Graph Image',
          type: 'image'
        }),
        defineField({
          name: 'keywords',
          title: 'Default Keywords',
          type: 'array',
          of: [{type: 'string'}],
          options: {
            layout: 'tags'
          }
        })
      ]
    }),
    defineField({
      name: 'analytics',
      title: 'Analytics & Tracking',
      type: 'object',
      fields: [
        defineField({
          name: 'googleAnalyticsId',
          title: 'Google Analytics ID',
          type: 'string'
        }),
        defineField({
          name: 'googleTagManagerId',
          title: 'Google Tag Manager ID',
          type: 'string'
        }),
        defineField({
          name: 'facebookPixelId',
          title: 'Facebook Pixel ID',
          type: 'string'
        })
      ]
    }),
    defineField({
      name: 'theme',
      title: 'Theme Settings',
      type: 'object',
      fields: [
        defineField({
          name: 'primaryColor',
          title: 'Primary Color',
          type: 'string',
          description: 'Hex color code (e.g., #3B82F6)'
        }),
        defineField({
          name: 'secondaryColor',
          title: 'Secondary Color',
          type: 'string',
          description: 'Hex color code (e.g., #1F2937)'
        }),
        defineField({
          name: 'accentColor',
          title: 'Accent Color',
          type: 'string',
          description: 'Hex color code (e.g., #10B981)'
        })
      ]
    }),
    defineField({
      name: 'features',
      title: 'Site Features',
      type: 'object',
      fields: [
        defineField({
          name: 'enableBlog',
          title: 'Enable Blog',
          type: 'boolean',
          initialValue: false
        }),
        defineField({
          name: 'enableBooking',
          title: 'Enable Room Booking',
          type: 'boolean',
          initialValue: true
        }),
        defineField({
          name: 'enableChat',
          title: 'Enable Live Chat',
          type: 'boolean',
          initialValue: false
        }),
        defineField({
          name: 'maintenanceMode',
          title: 'Maintenance Mode',
          type: 'boolean',
          initialValue: false
        })
      ]
    })
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'description'
    }
  }
})