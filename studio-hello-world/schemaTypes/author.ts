import {defineField, defineType} from 'sanity'
import {UserIcon} from '@sanity/icons'

export default defineType({
  name: 'author',
  title: 'Author',
  type: 'document',
  icon: UserIcon,
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'name',
        maxLength: 96,
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'role',
      title: 'Role',
      type: 'string',
      description: 'Job title or role at Hyve',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'bio',
      title: 'Bio',
      type: 'text',
      rows: 4,
      description: 'Short biography for author page and article bylines',
    }),
    defineField({
      name: 'avatar',
      title: 'Avatar',
      type: 'image',
      options: {
        hotspot: true,
      },
      fields: [
        {
          name: 'alt',
          type: 'string',
          title: 'Alternative Text',
          validation: (rule) => rule.required(),
        },
      ],
    }),
    defineField({
      name: 'email',
      title: 'Email',
      type: 'email',
      description: 'Contact email (will not be displayed publicly)',
    }),
    defineField({
      name: 'socialMedia',
      title: 'Social Media',
      type: 'object',
      fields: [
        {
          name: 'linkedin',
          title: 'LinkedIn',
          type: 'url',
          validation: (rule) => rule.uri({
            scheme: ['https'],
            allowRelative: false,
          }),
        },
        {
          name: 'twitter',
          title: 'Twitter/X',
          type: 'url',
          validation: (rule) => rule.uri({
            scheme: ['https'],
            allowRelative: false,
          }),
        },
        {
          name: 'website',
          title: 'Personal Website',
          type: 'url',
          validation: (rule) => rule.uri({
            scheme: ['https', 'http'],
            allowRelative: false,
          }),
        },
      ],
      options: {
        collapsible: true,
        collapsed: true,
      },
    }),
    defineField({
      name: 'featured',
      title: 'Featured Author',
      type: 'boolean',
      initialValue: false,
      description: 'Mark as featured to show on team/about pages',
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          {title: 'Active', value: 'active'},
          {title: 'Inactive', value: 'inactive'},
        ],
      },
      initialValue: 'active',
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: {
      title: 'name',
      subtitle: 'role',
      media: 'avatar',
      status: 'status',
    },
    prepare({title, subtitle, media, status}) {
      const statusIndicator = status === 'active' ? '✅' : '❌'
      
      return {
        title: `${statusIndicator} ${title}`,
        subtitle,
        media,
      }
    },
  },
})