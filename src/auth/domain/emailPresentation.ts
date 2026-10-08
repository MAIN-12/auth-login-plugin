export interface EmailColors {
  primary: string
  primaryText: string
  accent: string
  text: string
  textSecondary: string
  textTertiary: string
  background: string
  backgroundSecondary: string
  border: string
}
export const DEFAULT_COLORS: EmailColors = {
  primary: '#D5E855',
  primaryText: '#1d1d1f',
  accent: '#0071e3',
  text: '#1d1d1f',
  textSecondary: '#6e6e73',
  textTertiary: '#86868b',
  background: '#ffffff',
  backgroundSecondary: '#f5f5f7',
  border: '#d2d2d7',
}
export function escapeEmailText(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  )
}
export function validatedEmailUrl(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('auth-login: email URL requires absolute HTTPS URL')
  }
  if (url.protocol !== 'https:' || url.username || url.password)
    throw new Error('auth-login: email URL requires HTTPS without credentials')
  return escapeEmailText(url.href)
}
export function resolveEmailColors(colors?: Partial<EmailColors>): EmailColors {
  const result = { ...DEFAULT_COLORS }
  for (const key of Object.keys(result) as Array<keyof EmailColors>) {
    const value = colors?.[key]
    if (value !== undefined) {
      if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`auth-login: invalid email color ${key}`)
      result[key] = value
    }
  }
  return Object.freeze(result)
}

/** Browser locale is explicit; unsupported values retain the instance fallback. */
export function selectEmailLocale(locale: string | null, fallback: 'es' | 'en'): 'es' | 'en' {
  return locale === 'es' || locale === 'en' ? locale : fallback
}
