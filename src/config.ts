import type React from 'react'

/**
 * Shared plugin configuration — set by the plugin factory at init time,
 * read by all client components at render time.
 */
export type AuthStyle = 'tailwind' | 'hero-ui'

/** Serializable auth config that can be written to/read from file */
export interface SerializableAuthConfig {
  googleOAuthEnabled: boolean
  style: AuthStyle
  allowSignup: boolean
  passwordLogin: boolean
  otpLogin: boolean
}

export const pluginConfig: {
  _initialized: boolean
  style: AuthStyle
  logoUrl?: string
  Logo?: React.ComponentType
  googleOAuthEnabled: boolean
  modalLogin: boolean
  routeRedirects: boolean
  authBasePath: string
  passwordLogin: boolean
  otpLogin: boolean
  allowSignup: boolean
} = {
  _initialized: false,
  style: 'tailwind',
  googleOAuthEnabled: false,
  modalLogin: false,
  routeRedirects: false,
  authBasePath: '/auth',
  passwordLogin: true,
  otpLogin: true,
  allowSignup: true,
}

/** Resolve config across Payload and Next server module boundaries. */
export function getServerAllowSignup(): boolean {
  if (process.env.AUTH_LOGIN_ALLOW_SIGNUP === 'false') return false
  if (process.env.AUTH_LOGIN_ALLOW_SIGNUP === 'true') return true
  return pluginConfig.allowSignup
}

export function getServerGoogleOAuthEnabled(): boolean {
  if (process.env.AUTH_LOGIN_GOOGLE_OAUTH === 'false') return false
  if (process.env.AUTH_LOGIN_GOOGLE_OAUTH === 'true') return true
  return pluginConfig.googleOAuthEnabled || Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

/** Call this client-side to mirror the server plugin config. */
export function initClientConfig(opts: {
  style?: AuthStyle
  googleOAuthEnabled?: boolean
  passwordLogin?: boolean
  otpLogin?: boolean
}) {
  if (opts.style) pluginConfig.style = opts.style
  if (opts.googleOAuthEnabled !== undefined) pluginConfig.googleOAuthEnabled = opts.googleOAuthEnabled
  if (opts.passwordLogin !== undefined) pluginConfig.passwordLogin = opts.passwordLogin
  if (opts.otpLogin !== undefined) pluginConfig.otpLogin = opts.otpLogin
}
/** Server/proxy config may be bundled separately from the plugin factory. */
export function getServerModalLogin(): boolean {
  return process.env.AUTH_LOGIN_MODAL_LOGIN === 'true' || pluginConfig.modalLogin
}

/** Serializable settings bridge for separately bundled React server components. */
export function getServerProviderConfig() {
  const serialized = process.env.AUTH_LOGIN_PROVIDER_CONFIG
  const settings = serialized ? JSON.parse(serialized) as {
    style: AuthStyle; modalLogin: boolean; routeRedirects: boolean; authBasePath: string; passwordLogin: boolean;
    otpLogin: boolean; allowSignup: boolean; googleOAuthEnabled: boolean; logoUrl?: string
  } : pluginConfig
  return settings
}
