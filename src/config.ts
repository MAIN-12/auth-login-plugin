import { resolveEmailColors, validatedEmailUrl } from './auth/domain/emailPresentation'
import type { GoogleOptions } from './googleOptions'
import type { AdminOptions } from './adminOptions'
import type { OtpOptions } from './otpOptions'
export type { OtpOptions } from './otpOptions'
import type { PublicAuthConfig, AuthStyle } from './auth/contracts/publicConfig'
export type {
  PublicAuthConfig,
  SerializableAuthConfig,
  AuthStyle,
} from './auth/contracts/publicConfig'

export interface AuthLoginPluginOptions {
  enabled?: boolean
  collection?: string
  apiPrefix?: string
  authEndpointPrefix?: string
  /** Frontend auth-page mount. Use '' for root routes such as /login; defaults to /auth. */
  basePath?: string
  locale?: 'es' | 'en'
  style?: AuthStyle
  logo?: string
  projectName?: string
  passwordLogin: boolean
  otpLogin: boolean
  providers: { google: false | GoogleOptions }
  admin?: AdminOptions
  allowSignup: boolean
  recovery: boolean
  /** Seconds; absolute lifetime measured from Payload session.createdAt. Default 7200. */
  session?: { maxAge?: number }
  otp?: OtpOptions
  modalLogin?: boolean
  routeRedirects?: boolean | { basePath?: string }
}

export function resolveAuthConfig(options: AuthLoginPluginOptions): PublicAuthConfig {
  if (!options || typeof options !== 'object' || Array.isArray(options))
    throw new Error('auth-login: options must be an object')
  for (const key of ['enabled', 'modalLogin'] as const) {
    if (options[key] !== undefined && typeof options[key] !== 'boolean')
      throw new Error(`auth-login: invalid ${key}`)
  }
  if (
    options.routeRedirects !== undefined &&
    typeof options.routeRedirects !== 'boolean' &&
    (typeof options.routeRedirects !== 'object' ||
      options.routeRedirects === null ||
      Array.isArray(options.routeRedirects))
  )
    throw new Error('auth-login: invalid routeRedirects')
  if (options.projectName !== undefined && typeof options.projectName !== 'string')
    throw new Error('auth-login: invalid projectName')
  if (
    options.session !== undefined &&
    (typeof options.session !== 'object' ||
      options.session === null ||
      Array.isArray(options.session))
  )
    throw new Error('auth-login: invalid session')
  const google = options.providers?.google
  for (const key of ['passwordLogin', 'otpLogin', 'allowSignup', 'recovery'] as const) {
    if (typeof options[key] !== 'boolean') throw new Error(`auth-login: ${key} must be explicit`)
  }
  if (google !== false && (typeof google !== 'object' || typeof google.enabled !== 'boolean'))
    throw new Error('auth-login: providers.google must be explicit')
  if (options.locale !== undefined && !['es', 'en'].includes(options.locale))
    throw new Error('auth-login: locale must be es or en')
  const googleEnabled = google !== false && google.enabled
  if (googleEnabled) {
    if (
      typeof google.clientId !== 'string' ||
      !google.clientId ||
      typeof google.clientSecret !== 'string' ||
      !google.clientSecret ||
      typeof google.redirectURI !== 'string' ||
      !google.redirectURI
    )
      throw new Error('auth-login: Google requires clientId, clientSecret and redirectURI')
    try {
      const url = new URL(google.redirectURI)
      if (
        url.username ||
        url.password ||
        url.hash ||
        (url.protocol !== 'https:' &&
          !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
      )
        throw new Error()
    } catch {
      throw new Error('auth-login: invalid Google redirectURI')
    }
    if (google.customFetch !== undefined && typeof google.customFetch !== 'function')
      throw new Error('auth-login: invalid Google customFetch')
  }
  if (!options.passwordLogin && !options.otpLogin && !googleEnabled)
    throw new Error('auth-login: no usable login method')
  if (options.allowSignup && !options.passwordLogin && !googleEnabled)
    throw new Error('auth-login: signup requires password login')
  if (options.recovery && !options.passwordLogin)
    throw new Error('auth-login: recovery requires password login')
  if (options.otpLogin || (options.allowSignup && options.passwordLogin) || options.recovery) {
    if (
      !options.otp ||
      (options.otp.secret !== undefined &&
        (typeof options.otp.secret !== 'string' || options.otp.secret.length < 32)) ||
      typeof options.otp.origin !== 'function'
    )
      throw new Error(
        'auth-login: OTP requires trusted origin resolver and an optional secret of at least 32 characters',
      )
    for (const key of [
      'ttlSeconds',
      'cooldownSeconds',
      'maxAttempts',
      'accountLimit',
      'originLimit',
    ] as const)
      if (
        options.otp[key] !== undefined &&
        (!Number.isSafeInteger(options.otp[key]) || options.otp[key]! < 1)
      )
        throw new Error(`auth-login: invalid otp.${key}`)
    if (options.otp.now !== undefined && typeof options.otp.now !== 'function')
      throw new Error('auth-login: invalid OTP clock')
    if (!options.otp.email)
      throw new Error('auth-login: OTP requires explicit email sender and locale')
    if (
      options.otp.email &&
      (typeof options.otp.email.from !== 'string' ||
        !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(options.otp.email.from) ||
        !['es', 'en'].includes(options.otp.email.locale))
    )
      throw new Error('auth-login: invalid OTP email configuration')
    if (
      options.otp.email.projectName !== undefined &&
      typeof options.otp.email.projectName !== 'string'
    )
      throw new Error('auth-login: invalid OTP projectName')
    resolveEmailColors(options.otp.email.colors)
    if (
      options.otp.email.contactEmail &&
      !/^[^\s<>"'@]+@[^\s<>"'@]+\.[^\s<>"'@]+$/.test(options.otp.email.contactEmail)
    )
      throw new Error('auth-login: invalid contactEmail')
    for (const url of [
      options.otp.email?.logoUrl,
      options.otp.email?.contactUrl,
      options.otp.email?.domain,
    ])
      if (url !== undefined) {
        try {
          validatedEmailUrl(url)
        } catch {
          throw new Error('auth-login: OTP email URLs require HTTPS')
        }
      }
  }
  const maxAge = options.session?.maxAge ?? 7200
  if (!Number.isSafeInteger(maxAge) || maxAge < 1)
    throw new Error('auth-login: session.maxAge must be a positive integer in seconds')
  const path = (value: string, label: string) => {
    if (
      typeof value !== 'string' ||
      !/^\/[a-zA-Z0-9/_-]+$/.test(value) ||
      value.includes('//') ||
      value.endsWith('/')
    )
      throw new Error(`auth-login: invalid ${label}`)
    return value
  }
  const collection = options.collection ?? 'users'
  if (typeof collection !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(collection))
    throw new Error('auth-login: invalid collection')
  if (options.style !== undefined && options.style !== 'tailwind' && options.style !== 'hero-ui')
    throw new Error('auth-login: invalid style')
  if (options.logo !== undefined && typeof options.logo !== 'string')
    throw new Error(
      'auth-login: logo must be a serializable URL; pass React branding directly to UI',
    )
  if (options.logo && !/^\/(?!\/)[a-zA-Z0-9/_.-]+$/.test(options.logo))
    validatedEmailUrl(options.logo)
  const frontendBasePath =
    options.basePath ??
    (typeof options.routeRedirects === 'object' ? options.routeRedirects.basePath : undefined) ??
    '/auth'
  return Object.freeze({
    collection,
    apiPrefix: path(options.apiPrefix ?? '/api', 'apiPrefix'),
    authEndpointPrefix: path(options.authEndpointPrefix ?? '/auth', 'authEndpointPrefix'),
    // Empty is a root frontend mount, never an API/endpoint prefix.
    authBasePath: frontendBasePath === '' ? '' : path(frontendBasePath, 'basePath'),
    locale: options.locale ?? options.otp?.email?.locale ?? 'en',
    style: options.style ?? 'tailwind',
    logoUrl: options.logo,
    projectName: options.projectName,
    passwordLogin: options.passwordLogin,
    otpLogin: options.otpLogin,
    googleOAuthEnabled: googleEnabled,
    allowSignup: options.allowSignup,
    recovery: options.recovery,
    modalLogin: options.modalLogin === true,
    routeRedirects: Boolean(options.routeRedirects) && !options.modalLogin,
  })
}
