import type { Config } from 'payload'
import { authEndpoints } from './endpoints/authEndpoints'
import { googleOAuthEndpoints } from './endpoints/googleOAuth'
import { pluginConfig, type AuthStyle } from './config'

export interface GoogleOAuthConfig {
  /** Client ID from Google Cloud Console */
  clientId?: string
  /** Client Secret from Google Cloud Console */
  clientSecret?: string
  /** Toggle provider on/off */
  enabled?: boolean
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

  // Explicit config provided
  if (typeof google === 'object' && google.clientId && google.clientSecret) {
    return { enabled: true, clientId: google.clientId, clientSecret: google.clientSecret }
  }

  // Auto-detect from env
  const envId = process.env.GOOGLE_CLIENT_ID || ''
  const envSecret = process.env.GOOGLE_CLIENT_SECRET || ''
  const hasEnvCreds = !!(envId && envSecret)

  return { enabled: hasEnvCreds, clientId: envId, clientSecret: envSecret }
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
  (options: AuthLoginPluginOptions = {}) =>
  (config: Config): Config => {
    if (options.enabled === false) return config

    // Resolve provider config
    const googleConfig = resolveGoogleConfig(options.providers)
    setOAuthEnv(googleConfig)

    // Set global config — all components read this at render time
    pluginConfig.style = options.style || 'tailwind'
    if (typeof options.logo === 'string') {
      pluginConfig.logoUrl = options.logo
    } else {
      pluginConfig.Logo = options.logo
    }
    pluginConfig.googleOAuthEnabled = googleConfig.enabled

    // Register auth API endpoints
    config.endpoints = [...(config.endpoints || []), ...authEndpoints]

    // Register Google OAuth endpoints only if enabled
    if (pluginConfig.googleOAuthEnabled) {
      config.endpoints = [...config.endpoints, ...googleOAuthEndpoints]
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

export { pluginConfig }