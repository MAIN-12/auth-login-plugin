import AuthPagesClient from './AuthPages'
import type { AuthPagesProps } from './AuthPages'

export type { AuthPagesProps }

/**
 * Server component wrapper for AuthPages.
 * Reads plugin config via env vars (set by the plugin at init time)
 * and passes it to the client component automatically.
 *
 * ```tsx
 * // app/(auth)/auth/[...slug]/page.tsx  (NO 'use client' needed!)
 * import { AuthPages } from '@main12/auth-login/rsc'
 * export default async function Page({ params }) {
 *   const { slug } = await params
 *   return <AuthPages slug={slug} />
 * }
 * ```
 */
export default function AuthPages(props: AuthPagesProps) {
  const googleOAuthEnabled = process.env.AUTH_PLUGIN_GOOGLE_OAUTH === 'true'
  const style = (process.env.AUTH_PLUGIN_STYLE as 'tailwind' | 'hero-ui') || 'tailwind'

  const allowSignup = process.env.AUTH_PLUGIN_ALLOW_SIGNUP !== 'false'
  const passwordLogin = process.env.AUTH_PLUGIN_PASSWORD_LOGIN !== 'false'
  const otpLogin = process.env.AUTH_PLUGIN_OTP_LOGIN !== 'false'

  return (
    <AuthPagesClient
      {...props}
      showGoogleOAuth={props.showGoogleOAuth ?? googleOAuthEnabled}
      style={props.style ?? style}
      allowSignup={props.allowSignup ?? allowSignup}
      passwordLogin={passwordLogin}
      otpLogin={otpLogin}
    />
  )
}
