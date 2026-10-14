export type SupportedAuthLocale = 'es' | 'en'

/** Resolve one explicit language tag/header; unsupported languages retain the instance default. */
export function normalizeAuthLocale(
  locale: string | null | undefined,
  fallback: SupportedAuthLocale = 'en',
): SupportedAuthLocale {
  const tag = locale?.split(',')[0]?.split(';')[0]?.trim()
  if (!tag || !/^[a-z]{2}(?:[-_][a-z0-9]{2,8})*$/i.test(tag)) return fallback
  const primary = tag.split(/[-_]/)[0].toLowerCase()
  return primary === 'es' || primary === 'en' ? primary : fallback
}
