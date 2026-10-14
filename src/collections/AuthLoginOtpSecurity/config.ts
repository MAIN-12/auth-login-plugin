import type { CollectionConfig } from 'payload'
import { internalCollectionOptions } from '../../shared/infrastructure/payload/internalCollectionOptions'

export const AuthLoginOtpSecurity: CollectionConfig = {
  ...internalCollectionOptions,
  slug: 'auth-login-otp-security',
  dbName: 'auth_login_otp_security',
  fields: [
    { name: 'key', type: 'text', required: true, unique: true },
    { name: 'value', type: 'text' },
  ],
}
