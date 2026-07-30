import type { Config } from 'payload'
import { authEndpoints } from './endpoints/authEndpoints.js'
import { googleOAuthEndpoints } from './endpoints/googleOAuth.js'
import { pluginConfig, type AuthStyle } from './config.js'

export interface AuthLoginPluginOptions {
  enabled?: boolean
  projectName?: string
  contactEmail?: string
  domain?: string
  style?: AuthStyle
  logo?: string
  /** Enable Google OAuth — reads GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from env */
  googleOAuth?: boolean
}

export const authLoginPlugin =
  (options: AuthLoginPluginOptions = {}) =>
  (config: Config): Config => {
    if (options.enabled === false) return config

    // Set global style config — all page components read this at render time
    pluginConfig.style = options.style || 'tailwind'
    pluginConfig.logoUrl = options.logo

    // Register auth API endpoints
    config.endpoints = [...(config.endpoints || []), ...authEndpoints]

    // Register Google OAuth endpoints if enabled
    if (options.googleOAuth !== false) {
      config.endpoints = [...config.endpoints, ...googleOAuthEndpoints]
    }

    // Chain onInit
    const incomingOnInit = config.onInit
    config.onInit = async (payload) => {
      if (incomingOnInit) await incomingOnInit(payload)
      payload.logger.info(`[auth-login] Initialized (style: ${pluginConfig.style}) for ${options.projectName || 'project'}`)
    }

    return config
  }

export { pluginConfig }