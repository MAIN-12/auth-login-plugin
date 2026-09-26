import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import AuthPagesClient from './AuthPages'
import type { AuthPagesProps } from './AuthPages'
import { getServerAllowSignup, getServerGoogleOAuthEnabled, pluginConfig } from '../config'
import { detectServerLocale } from './ui/locale'

export type { AuthPagesProps }

// Use pluginConfig singleton directly - standard Payload plugin pattern

/**
 * Server component wrapper for AuthPages.
 * Reads plugin config from environment variables set during plugin initialization,
 * ensuring the correct settings are used even in linked monorepo setups where
 * module singletons may not be shared across entry points.
 *
 * Locale is resolved per-request: an explicit `locale` prop always wins,
 * otherwise it's auto-detected from the `NEXT_LOCALE` cookie or
 * `Accept-Language` header (works automatically with next-intl,
 * next-i18next, or no i18n library at all — no dependency required).
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
export default async function AuthPages(props: AuthPagesProps) {
  const resolvedLocale = props.locale ?? detectServerLocale(await headers())
  const resolvedAllowSignup = props.allowSignup ?? getServerAllowSignup()
  const basePath = props.basePath?.replace(/\/$/, '') ?? '/auth'

  // Redirect /signup to /login when signup is disabled
  const currentSlug = Array.isArray(props.slug) ? props.slug[0] : props.slug
  if (!resolvedAllowSignup && currentSlug === 'signup') {
    redirect(`${basePath}/login`)
  }

  return (
    <AuthPagesClient
      {...props}
      showGoogleOAuth={props.showGoogleOAuth ?? getServerGoogleOAuthEnabled()}
      allowSignup={resolvedAllowSignup}
      passwordLogin={pluginConfig.passwordLogin}
      otpLogin={pluginConfig.otpLogin}
      locale={resolvedLocale}
    />
  )
}
