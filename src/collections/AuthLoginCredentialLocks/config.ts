import type { CollectionConfig } from 'payload'
import { internalCollectionOptions } from '../../shared/infrastructure/payload/internalCollectionOptions'

export const AuthLoginCredentialLocks: CollectionConfig = {
  ...internalCollectionOptions,
  slug: 'auth-login-credential-locks',
  dbName: 'auth_login_credential_locks',
  fields: [{ name: 'key', type: 'text', required: true, unique: true }],
}
