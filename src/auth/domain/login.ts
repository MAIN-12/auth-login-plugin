export type AuthErrorCode = 'INVALID_INPUT' | 'AUTH_FAILED' | 'METHOD_DISABLED' | 'UNAUTHENTICATED' | 'AUTH_UNAVAILABLE' | 'ORIGIN_DENIED'
export interface AuthErrorResponse { success: false; code: AuthErrorCode }
export class AuthFailure extends Error {
  constructor(public readonly code: AuthErrorCode, public readonly status: number) { super(code) }
}
export interface PasswordCredentials { email: string; password: string }
export function parsePasswordCredentials(input: unknown): PasswordCredentials {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AuthFailure('INVALID_INPUT', 400)
  const data = input as Record<string, unknown>
  if (Object.keys(data).some(key => !['email', 'password'].includes(key))) throw new AuthFailure('INVALID_INPUT', 400)
  if (typeof data.email !== 'string' || typeof data.password !== 'string' || data.password.length < 1 || data.password.length > 1024 || data.email.length > 254) throw new AuthFailure('INVALID_INPUT', 400)
  const email = data.email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AuthFailure('INVALID_INPUT', 400)
  return { email, password: data.password }
}
/** Payload-bound authentication stays in the adapter; method/entry policy stays here. */
export function createPasswordLogin<T>(dependencies: { enabled: boolean; authenticate: (credentials: PasswordCredentials) => Promise<T> }) {
  return async (input: unknown): Promise<T> => {
    if (!dependencies.enabled) throw new AuthFailure('METHOD_DISABLED', 403)
    return dependencies.authenticate(parsePasswordCredentials(input))
  }
}
