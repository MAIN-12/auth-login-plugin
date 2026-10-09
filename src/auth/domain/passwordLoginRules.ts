import { AuthOperationFailure } from './errors'
export interface PasswordCredentials {
  email: string
  password: string
}
export function parsePasswordCredentials(input: unknown): PasswordCredentials {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new AuthOperationFailure('INVALID_INPUT')
  const data = input as Record<string, unknown>
  if (Object.keys(data).some((key) => !['email', 'password'].includes(key)))
    throw new AuthOperationFailure('INVALID_INPUT')
  if (
    typeof data.email !== 'string' ||
    typeof data.password !== 'string' ||
    data.password.length < 1 ||
    data.password.length > 1024 ||
    data.email.length > 254
  )
    throw new AuthOperationFailure('INVALID_INPUT')
  const email = data.email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AuthOperationFailure('INVALID_INPUT')
  return { email, password: data.password }
}
