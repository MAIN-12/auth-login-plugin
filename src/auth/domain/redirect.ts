/** Only allow local application destinations, including query strings and hashes. */
export function safeAuthRedirect(value: string | null | undefined, fallback = '/'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x20]/.test(value))
    return fallback
  try {
    let path = value.split(/[?#]/, 1)[0]
    // Repeated decoding models intermediaries without changing the returned destination.
    for (let depth = 0; depth < 8; depth++) {
      if (!path.startsWith('/') || path.startsWith('//') || /[\\\x00-\x20]/.test(path))
        return fallback
      const decoded = decodeURIComponent(path)
      if (decoded === path) break
      path = decoded
      if (depth === 7) return fallback
    }
    const url = new URL(value, 'https://auth.invalid')
    return url.origin === 'https://auth.invalid' && !url.pathname.startsWith('//')
      ? url.pathname + url.search + url.hash
      : fallback
  } catch {
    return fallback
  }
}
