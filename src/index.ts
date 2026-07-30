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
  /** Enable Google OAuth. Default: auto-detects GOOGLE_CLIENT_ID env var. Set false to force-disable. */
  googleOAuth?: boolean
}

export const authLoginPlugin =
  (options: AuthLoginPluginOptions = {}) =>
  (config: Config): Config => {
    if (options.enabled === false) return config

    // Set global config — all components read this at render time
    pluginConfig.style = options.style || 'tailwind'
    pluginConfig.logoUrl = options.logo

    // Google OAuth: auto-detect from env vars
    if (options.googleOAuth === false) {
      pluginConfig.googleOAuthEnabled = false
    } else {
      const hasGoogleCreds = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
      pluginConfig.googleOAuthEnabled = options.googleOAuth === true || hasGoogleCreds
    }

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