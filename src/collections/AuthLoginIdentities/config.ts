import type { CollectionConfig } from 'payload'
import { internalCollectionOptions } from '../../shared/infrastructure/payload/internalCollectionOptions'

export const AuthLoginIdentities: CollectionConfig = {
  ...internalCollectionOptions,
  slug: 'auth-login-identities',
  dbName: 'auth_login_identities',
  fields: [
    { name: 'collection', type: 'text', required: true },
    { name: 'provider', type: 'text', required: true },
    { name: 'subject', type: 'text', required: true },
    { name: 'account', type: 'text', required: true },
  ],
  indexes: [
    { fields: ['collection', 'provider', 'subject'], unique: true },
    { fields: ['collection', 'account', 'provider'], unique: true },
  ],
}
