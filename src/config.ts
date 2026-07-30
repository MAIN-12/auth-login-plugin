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
} = {
  style: 'tailwind',
  googleOAuthEnabled: true,
}

/** Call this client-side to mirror the server plugin config. */
export function initClientConfig(opts: { style?: AuthStyle; googleOAuthEnabled?: boolean }) {
  if (opts.style) pluginConfig.style = opts.style
  if (opts.googleOAuthEnabled !== undefined) pluginConfig.googleOAuthEnabled = opts.googleOAuthEnabled
}