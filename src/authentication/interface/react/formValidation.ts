/** Mirrors auth HTTP email admission without importing server transport into the client. */
export function isAuthEmailValid(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

/** Login/reauthentication must accept existing passwords, not enforce establishment strength. */
export function isExistingPasswordValid(password: string): boolean {
  return password.length > 0 && password.length <= 1024
}
