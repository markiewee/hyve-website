import {createMigrationUtils} from '@sanity/migrate'

const {client} = createMigrationUtils({
  projectId: 'ydn0o1zt',
  dataset: 'production',
  apiVersion: '2024-01-01'
})

const migration = {
  title: 'Update room availability with future dates',
  documentTypes: ['room'],
  migrate: async (documents: any[]) => {
    return documents.map((doc) => {
      // For demo purposes, set some rooms as not available with future dates
      if (doc._id && doc._id.includes('room')) {
        // Sample logic to set some rooms as unavailable with future dates
        if (doc.roomNumber === 'A2' || doc.roomNumber === 'B3') {
          return {
            ...doc,
            isAvailable: false,
            availableFrom: doc.roomNumber === 'A2' ? '2025-02-15' : '2025-01-20'
          }
        }
      }
      return doc
    })
  }
}

export default migration