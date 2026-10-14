import type { CollectionConfig } from 'payload'

/** Managed schema, server-only native coordination. Local API overrideAccess remains trusted. */
const deny = () => false
export const internalCollectionOptions = {
  admin: { hidden: true },
  access: {
    admin: deny,
    create: deny,
    read: deny,
    update: deny,
    delete: deny,
    unlock: deny,
    readVersions: deny,
  },
  endpoints: false,
  graphQL: false,
  lockDocuments: false,
  timestamps: false,
} satisfies Omit<CollectionConfig, 'slug' | 'fields'>
