'use client'

import { pluginConfig, initClientConfig, type AuthStyle } from '../config'

export interface AuthClientInitProps {
  /** Override UI style. If omitted, reads from plugin config. */
  style?: AuthStyle
  /** Override Google OAuth visibility. If omitted, reads from plugin config. */
  googleOAuthEnabled?: boolean
}

/**
 * Drop this component into your root layout to sync the server-side
 * plugin config to client components. No props needed — it reads
 * everything from the plugin configuration automatically.
 *
 * ```tsx
 * // app/(frontend)/layout.tsx
 * import { AuthClientInit } from '@main12/auth-login/client'
 *
 * export default function Layout({ children }) {
 *   return (
 *     <html><body>
 *       <AuthClientInit />
 *       {children}
 *     </body></html>
 *   )
 * }
 * ```
 */
export function AuthClientInit({ style, googleOAuthEnabled }: AuthClientInitProps = {}) {
  initClientConfig({
    style: style ?? pluginConfig.style,
    googleOAuthEnabled: googleOAuthEnabled ?? pluginConfig.googleOAuthEnabled,
    passwordLogin: pluginConfig.passwordLogin,
    otpLogin: pluginConfig.otpLogin,
  })
  return null
}
