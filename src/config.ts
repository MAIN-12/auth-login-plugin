/**
 * Shared plugin configuration — set by the plugin factory at init time,
 * read by all client components at render time.
 */
export type AuthStyle = 'tailwind' | 'hero-ui'

export const pluginConfig: {
  style: AuthStyle
  logoUrl?: string
  googleOAuthEnabled: boolean
} = {
  style: 'tailwind',
  googleOAuthEnabled: true,
}