export type AuthStyle = 'tailwind' | 'hero-ui'

/** Only this explicit, immutable value crosses server/client boundaries. */
export interface PublicAuthConfig {
  readonly collection: string
  readonly apiPrefix: string
  readonly authEndpointPrefix: string
  readonly authBasePath: string
  /** Installation fallback; effective language belongs to the presentation/request scope. */
  readonly locale?: 'es' | 'en'
  readonly style: AuthStyle
  readonly logoUrl?: string
  readonly projectName?: string
  readonly passwordLogin: boolean
  readonly otpLogin: boolean
  readonly googleOAuthEnabled: boolean
  readonly allowSignup: boolean
  readonly recovery: boolean
  readonly modalLogin: boolean
  readonly routeRedirects: boolean
}
export type SerializableAuthConfig = PublicAuthConfig
