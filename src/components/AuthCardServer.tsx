import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { AuthCard as AuthCardClient, type AuthCardWithSlugProps, type AuthCardWithChildrenProps } from './AuthCard'
import { getServerAllowSignup, getServerGoogleOAuthEnabled, pluginConfig } from '../config'
import { detectServerLocale } from './ui/locale'

export type { AuthCardWithSlugProps, AuthCardWithChildrenProps }
export type AuthCardProps = AuthCardWithSlugProps | AuthCardWithChildrenProps

// Use pluginConfig singleton directly - standard Payload plugin pattern

/**
 * Server component wrapper for AuthCard.
 * Reads plugin config directly from the shared `pluginConfig` singleton
 * (set by the plugin factory at Payload config build time) and passes it
 * down to the client component. This ensures settings like `googleOAuthEnabled`,
 * `allowSignup`, `passwordLogin`, and `otpLogin` work automatically without
 * requiring explicit props.
 *
 * Locale is resolved per-request: an explicit `locale` prop always wins,
 * otherwise it's auto-detected from the `NEXT_LOCALE` cookie or
 * `Accept-Language` header.
 *
 * ```tsx
 * // app/auth/login/page.tsx  (NO 'use client' needed!)
 * import { AuthCard } from '@main12/auth-login/rsc'
 * export default async function Page() {
 *   return (
 *     <AuthCard
 *       slug="login"
 *       logo={<Logo />}
 *     />
 *   )
 * }
 * ```
 */
export async function AuthCard(props: AuthCardProps) {
  // Check if it's a slug-based AuthCard
  if ('slug' in props && props.slug !== undefined) {
    const slugProps = props as AuthCardWithSlugProps
    const resolvedLocale = slugProps.locale ?? detectServerLocale(await headers())
    const resolvedAllowSignup = slugProps.allowSignup ?? getServerAllowSignup()
    const basePath = slugProps.basePath?.replace(/\/$/, '') ?? '/auth'

    // Redirect /signup to /login when signup is disabled
    const currentSlug = Array.isArray(slugProps.slug) ? slugProps.slug[0] : slugProps.slug
    if (!resolvedAllowSignup && currentSlug === 'signup') {
      redirect(`${basePath}/login`)
    }

    return (
      <AuthCardClient
        {...slugProps}
        showGoogleOAuth={slugProps.showGoogleOAuth ?? getServerGoogleOAuthEnabled()}
        allowSignup={resolvedAllowSignup}
        passwordLogin={slugProps.passwordLogin ?? pluginConfig.passwordLogin}
        otpLogin={slugProps.otpLogin ?? pluginConfig.otpLogin}
        locale={resolvedLocale}
      />
    )
  }

  // Children-based AuthCard - just pass through
  return <AuthCardClient {...props} />
}
