/**
 * Zero-dependency locale detection.
 *
 * The plugin never imports next-intl, next-i18next, or any i18n library —
 * instead it reads the same conventional signals those libraries already
 * write, so `locale` "just works" automatically for consumers using them,
 * while still defaulting sanely (`en`) for consumers with no i18n setup.
 *
 * Priority order:
 *   1. Explicit `locale` prop passed to `<AuthPages />` (always wins, handled by caller)
 *   2. `NEXT_LOCALE` cookie — written by next-intl, next-i18next, and most
 *      i18n routing middlewares by convention
 *   3. `Accept-Language` request header (server-side only)
 *   4. `<html lang="...">` attribute (client-side only)
 *   5. Fallback: 'en'
 */

const SUPPORTED_FALLBACK = 'en'

/** Extract the primary language code from a locale string, e.g. 'es-MX' -> 'es'. */
function normalize(locale: string | null | undefined): string | undefined {
  if (!locale) return undefined
  const primary = locale.split(/[-_]/)[0]?.toLowerCase()
  return primary || undefined
}

/** Parse the `NEXT_LOCALE` cookie value from a raw `Cookie` header string. */
function parseCookieLocale(cookieHeader: string | null | undefined): string | undefined {
  if (!cookieHeader) return undefined
  const match = cookieHeader.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/)
  try { return match ? normalize(decodeURIComponent(match[1])) : undefined } catch { return undefined }
}

/** Parse the first preferred language from an `Accept-Language` header. */
function parseAcceptLanguage(header: string | null | undefined): string | undefined {
  if (!header) return undefined
  const first = header.split(',')[0]?.trim()
  return normalize(first)
}

/**
 * Server-side locale detection — reads `Cookie` and `Accept-Language` headers.
 * Use inside an RSC (e.g. `AuthPagesServer`) where `next/headers` is available.
 */
export function detectServerLocale(headers: { get(name: string): string | null }): string {
  const fromCookie = parseCookieLocale(headers.get('cookie'))
  if (fromCookie) return fromCookie
  const fromAcceptLanguage = parseAcceptLanguage(headers.get('accept-language'))
  if (fromAcceptLanguage) return fromAcceptLanguage
  return SUPPORTED_FALLBACK
}

/**
 * Client-side locale detection — reads the `NEXT_LOCALE` cookie or falls back
 * to `<html lang>`. Use inside client components when no explicit locale was
 * passed down from the server.
 */
export function detectClientLocale(): string {
  if (typeof document === 'undefined') return SUPPORTED_FALLBACK
  const fromCookie = parseCookieLocale(document.cookie)
  if (fromCookie) return fromCookie
  const fromHtmlLang = normalize(document.documentElement?.lang)
  if (fromHtmlLang) return fromHtmlLang
  return SUPPORTED_FALLBACK
}
