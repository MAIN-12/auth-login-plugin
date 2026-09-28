import type { Config } from 'payload'
import { safeAuthRedirect } from './auth/domain/redirect'
import { OAuth2Plugin } from 'payload-oauth2'
import { authEndpoints } from './endpoints/authEndpoints'
import { pluginConfig, type AuthStyle } from './config'

export interface GoogleOAuthConfig {
  /** Client ID from Google Cloud Console */
  clientId?: string
  /** Client Secret from Google Cloud Console */
  clientSecret?: string
  /** Toggle provider on/off */
  enabled?: boolean
  /** Where to redirect after successful Google login. Defaults to '/admin' */
  successRedirect?: string
  /** Where to redirect after failed Google login. Defaults to '/login?error=Google login failed' */
  failureRedirect?: string
  /**
   * Google OAuth prompt behavior.
   * - 'select_account' — always show account picker (recommended)
   * - 'consent' — prompt for consent every time
   * - 'none' — no prompt, use existing session
   * @default 'select_account'
   */
  prompt?: 'select_account' | 'consent' | 'none'
}

export interface AuthProvidersConfig {
  google?: GoogleOAuthConfig | boolean
  // Future: facebook, apple, etc.
}

export interface AuthLoginPluginOptions {
  enabled?: boolean
  projectName?: string
  contactEmail?: string
  domain?: string
  style?: AuthStyle
  logo?: string | React.ComponentType
  /**
   * OAuth providers configuration.
   * - Omit entirely → auto-detect from env vars (GOOGLE_CLIENT_ID, etc.)
   * - `{ google: true }` → use env vars
   * - `{ google: { clientId, clientSecret } }` → use explicit values
   * - `{ google: false }` → force-disable
   * - `{ google: { enabled: false } }` → temporarily disable without losing config
   */
  providers?: AuthProvidersConfig
  /**
   * Enable automatic route redirects from bare paths (e.g. /login)
   * to the catch-all auth path (e.g. /auth/login).
   *
   * - `true` → enable redirects (consumer must re-export proxy from their proxy.ts)
   * - `false` → disable redirects (consumer manages their own routes)
   * - `{ basePath: '/auth' }` → enable with custom base path
   *
   * @default false
   */
  routeRedirects?: boolean | { basePath?: string }
  /** Render login through AuthProvider. Overrides the plugin proxy redirects. @default false */
  modalLogin?: boolean
  /**
   * Allow new users to sign up.
   * When false, signup page is hidden, signup link is removed from login,
   * and Google OAuth rejects unregistered users.
   * @default true
   */
  allowSignup?: boolean
  /**
   * Allow login via password.
   * When true, users with passwords see the password step.
   * When false, all logins go through OTP.
   * @default true
   */
  passwordLogin?: boolean
  /**
   * Allow login via OTP (email verification code).
   * When true, users without passwords get OTP automatically,
   * and after OTP verification they go straight to the app.
   * When false, users are prompted to set a password after OTP.
   * @default true
   */
  otpLogin?: boolean
}

function resolveGoogleConfig(providers?: AuthProvidersConfig): {
  enabled: boolean
  clientId: string
  clientSecret: string
} {
  const google = providers?.google

  // Explicitly disabled
  if (google === false || (typeof google === 'object' && google.enabled === false)) {
    return { enabled: false, clientId: '', clientSecret: '' }
  }

  // Explicit config object — user intends to enable Google OAuth
  // Resolve credentials from explicit values or fall back to env vars
  if (typeof google === 'object') {
    const clientId = google.clientId || process.env.GOOGLE_CLIENT_ID || ''
    const clientSecret = google.clientSecret || process.env.GOOGLE_CLIENT_SECRET || ''
    return { enabled: true, clientId, clientSecret }
  }

  // google: true — auto-detect from env
  if (google === true) {
    const envId = process.env.GOOGLE_CLIENT_ID || ''
    const envSecret = process.env.GOOGLE_CLIENT_SECRET || ''
    return { enabled: !!(envId && envSecret), clientId: envId, clientSecret: envSecret }
  }

  // Not configured at all — disabled
  return { enabled: false, clientId: '', clientSecret: '' }
}

/**
 * Merge provider credentials into process.env so the OAuth endpoint can read them.
 * This allows explicit plugin config values to work alongside env vars.
 */
function setOAuthEnv(googleConfig: ReturnType<typeof resolveGoogleConfig>) {
  if (googleConfig.enabled && googleConfig.clientId) {
    process.env.GOOGLE_CLIENT_ID = googleConfig.clientId
    process.env.GOOGLE_CLIENT_SECRET = googleConfig.clientSecret
  }
}

export const authLoginPlugin =
  (options: AuthLoginPluginOptions = {}) => {
    if (options.enabled !== false) {
      process.env.AUTH_LOGIN_MODAL_LOGIN = String(options.modalLogin === true)
      process.env.AUTH_LOGIN_ALLOW_SIGNUP = String(options.allowSignup !== false)
      const googleConfig = resolveGoogleConfig(options.providers)
      process.env.AUTH_LOGIN_GOOGLE_OAUTH = String(googleConfig.enabled)
      process.env.AUTH_LOGIN_PROVIDER_CONFIG = JSON.stringify({
        style: options.style || 'tailwind',
        modalLogin: options.modalLogin === true,
        routeRedirects: Boolean(options.routeRedirects),
        authBasePath: typeof options.routeRedirects === 'object' ? options.routeRedirects.basePath || '/auth' : '/auth',
        passwordLogin: options.passwordLogin !== false,
        otpLogin: options.otpLogin !== false,
        allowSignup: options.allowSignup !== false,
        googleOAuthEnabled: googleConfig.enabled,
        logoUrl: typeof options.logo === 'string' ? options.logo : undefined,
      })
    }

    return async (config: Config): Promise<Config> => {
      if (options.enabled === false) return config

    // Resolve provider config
    const googleConfig = resolveGoogleConfig(options.providers)
    setOAuthEnv(googleConfig)

    // Set global config — all components (server and client) read this
    // shared singleton directly at render time. This is the single source
    // of truth for the main entry point.
    pluginConfig._initialized = true
    pluginConfig.style = options.style || 'tailwind'
    if (typeof options.logo === 'string') {
      pluginConfig.logoUrl = options.logo
    } else {
      pluginConfig.Logo = options.logo
    }
    pluginConfig.googleOAuthEnabled = googleConfig.enabled
    process.env.AUTH_LOGIN_GOOGLE_OAUTH = String(pluginConfig.googleOAuthEnabled)
    pluginConfig.allowSignup = options.allowSignup !== false
    process.env.AUTH_LOGIN_ALLOW_SIGNUP = String(pluginConfig.allowSignup)
    pluginConfig.passwordLogin = options.passwordLogin !== false
    pluginConfig.otpLogin = options.otpLogin !== false

    pluginConfig.modalLogin = options.modalLogin === true
    pluginConfig.routeRedirects = false
    pluginConfig.authBasePath = typeof options.routeRedirects === 'object' ? options.routeRedirects.basePath || '/auth' : '/auth'

    // Route redirects config
    if (options.routeRedirects && !pluginConfig.modalLogin) {
      pluginConfig.routeRedirects = true
      if (typeof options.routeRedirects === 'object' && options.routeRedirects.basePath) {
        pluginConfig.authBasePath = options.routeRedirects.basePath
      }
    }

    // Register hidden auth-otps collection for OTP storage
    config.collections = [
      ...(config.collections || []),
      {
        slug: 'auth-otps',
        admin: { hidden: true },
        // Only trusted Local API operations may read or mutate OTP records.
        access: { create: () => false, read: () => false, update: () => false, delete: () => false },
        fields: [
          { name: 'email', type: 'email', required: true, index: true },
          { name: 'hash', type: 'text', required: true },
          { name: 'purpose', type: 'text' },
          { name: 'attempts', type: 'number', defaultValue: 0 },
          { name: 'expiresAt', type: 'text' },
        ],
      },
    ]

    // Register auth API endpoints
    config.endpoints = [...(config.endpoints || []), ...authEndpoints]

    // Register Google OAuth via payload-oauth2 if enabled
    if (googleConfig.enabled) {
      const googleOpts = typeof options.providers?.google === 'object' ? options.providers.google : {}
      const serverURL = options.domain || process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

      config = await OAuth2Plugin({
        enabled: true,
        strategyName: 'google',
        useEmailAsIdentity: true,
        serverURL,
        clientId: googleConfig.clientId,
        clientSecret: googleConfig.clientSecret,
        tokenEndpoint: 'https://oauth2.googleapis.com/token',
        providerAuthorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        scopes: [
          'openid',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile',
        ],
        authorizePath: '/oauth/google',
        callbackPath: '/oauth/google/callback',
        prompt: googleOpts.prompt || 'select_account',
        getUserInfo: async (accessToken: string) => {
          const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          const user = await response.json() as { email: string; sub: string; name: string }
          return { email: user.email, sub: user.sub, name: user.name }
        },
        successRedirect: (req) => googleOpts.successRedirect || (options.modalLogin ? safeAuthRedirect(req.searchParams.get('state')) : '/admin'),
        failureRedirect: () => googleOpts.failureRedirect || (options.modalLogin ? `${pluginConfig.authBasePath}/login?error=Google%20login%20failed` : '/login?error=Google login failed'),
      })(config)
    }

    // Chain onInit
    const incomingOnInit = config.onInit
    config.onInit = async (payload) => {
      if (incomingOnInit) await incomingOnInit(payload)
      payload.logger.info(
        `[auth-login] Initialized (style: ${pluginConfig.style}, googleOAuth: ${pluginConfig.googleOAuthEnabled}) for ${options.projectName || 'project'}`,
      )
    }

      return config
    }
  }

export { pluginConfig }