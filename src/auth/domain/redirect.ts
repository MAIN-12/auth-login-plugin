/** Only allow local application destinations, including query strings and hashes. */
export function safeAuthRedirect(value: string | null | undefined, fallback = '/'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x20]/.test(value)) return fallback
  try {
    const url = new URL(value, 'https://auth.invalid')
    return url.origin === 'https://auth.invalid' && !url.pathname.startsWith('//') ? url.pathname + url.search + url.hash : fallback
  } catch { return fallback }
}
