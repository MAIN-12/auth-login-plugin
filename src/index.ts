export { authLoginPlugin } from './wiring/plugin'

export type {
  AuthLoginPluginOptions,
  PublicAuthConfig,
  SerializableAuthConfig,
  AuthStyle,
  AuthCardTheme,
  OtpOptions,
} from './configuration/plugin/config'
export type { AuthErrorCode, AuthErrorResponse } from './shared/contracts/errors'
export type { GoogleOptions } from './configuration/plugin/googleOptions'
export type { AdminOptions, AuthenticationEvidence } from './configuration/plugin/adminOptions'
export type { CredentialCapabilities } from './collections/ConfiguredAuthCollection/domain'

/** Unforgeable request-local method evidence for consumer server hooks, never a client capability. */
export { isOtpSessionRequest } from './collections/ConfiguredAuthCollection/index'

export { getAuthenticationEvidence } from './collections/ConfiguredAuthCollection/index'

export type {
  AuthEmailOverrides,
  AuthEmailParams,
  AuthEmailResult,
} from './shared/domain/emailTemplates'
