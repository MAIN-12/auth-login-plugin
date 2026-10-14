import type { CollectionConfig } from 'payload'
import { internalCollectionOptions } from '../../shared/infrastructure/payload/internalCollectionOptions'

export const AuthLoginPasswordPermits: CollectionConfig = {
  ...internalCollectionOptions,
  slug: 'auth-login-password-permits',
  dbName: 'auth_login_password_permits',
  fields: [
    { name: 'key', type: 'text', required: true, unique: true },
    { name: 'expires_at', type: 'number', required: true },
  ],
}
