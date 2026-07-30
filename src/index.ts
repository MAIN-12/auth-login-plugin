import type { Config } from 'payload'
import { authEndpoints } from './endpoints/authEndpoints.js'
import { pluginConfig, type AuthStyle } from './config.js'

export interface AuthLoginPluginOptions {
  enabled?: boolean
  projectName?: string
  contactEmail?: string
  domain?: string
  /** UI style for auth pages: 'tailwind' (default) or 'hero-ui' */
  style?: AuthStyle
}

export const authLoginPlugin =
  (options: AuthLoginPluginOptions = {}) =>
  (config: Config): Config => {
    if (options.enabled === false) return config

    // Set global style config — all page components read this at render time
    pluginConfig.style = options.style || 'tailwind'

    // Register auth API endpoints
    config.endpoints = [...(config.endpoints || []), ...authEndpoints]

    // Chain onInit
    const incomingOnInit = config.onInit
    config.onInit = async (payload) => {
      if (incomingOnInit) await incomingOnInit(payload)
      payload.logger.info(`[auth-login] Initialized (style: ${pluginConfig.style}) for ${options.projectName || 'project'}`)
    }

    return config
  }

export { pluginConfig }