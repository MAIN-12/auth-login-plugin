import type { CollectionConfig } from 'payload'
import { internalCollectionOptions } from '../../shared/infrastructure/payload/internalCollectionOptions'

export const AuthLoginCutovers: CollectionConfig = {
  ...internalCollectionOptions,
  slug: 'auth-login-cutovers',
  dbName: 'auth_login_cutovers',
  fields: [
    { name: 'collection', type: 'text', required: true, unique: true },
    { name: 'generation', type: 'text', required: true },
  ],
}
