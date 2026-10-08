export { authLoginPlugin } from './auth/composition/plugin'

export type {
  AuthLoginPluginOptions,
  PublicAuthConfig,
  SerializableAuthConfig,
  AuthStyle,
  OtpOptions,
} from './config'
export type { AuthErrorCode, AuthErrorResponse } from './auth/domain/login'
export type { GoogleOptions } from './googleOptions'
export type { AdminOptions, AuthenticationEvidence } from './adminOptions'
export type { CredentialCapabilities } from './auth/domain/credentials'

/** Unforgeable request-local method evidence for consumer server hooks, never a client capability. */
export { isOtpSessionRequest } from './auth/server/otpSession'

export { getAuthenticationEvidence } from './auth/server/adminPolicy'

/** Offline, account-preserving maintenance cutoff; never exposed through HTTP. */
export { migrateAuthLogin, type AuthLoginMigrationOptions } from './auth/server/migration'
