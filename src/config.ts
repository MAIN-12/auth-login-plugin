import type React from 'react'

/**
 * Shared plugin configuration — set by the plugin factory at init time,
 * read by all client components at render time.
 */
export type AuthStyle = 'tailwind' | 'hero-ui'

export const pluginConfig: {
  style: AuthStyle
  logoUrl?: string
  Logo?: React.ComponentType
  googleOAuthEnabled: boolean
  routeRedirects: boolean
  authBasePath: string
  passwordLogin: boolean
  otpLogin: boolean
} = {
  style: 'tailwind',
  googleOAuthEnabled: false,
  routeRedirects: false,
  authBasePath: '/auth',
  passwordLogin: true,
  otpLogin: true,
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