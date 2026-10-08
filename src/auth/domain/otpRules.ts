import { AuthOperationFailure } from './errors'

export interface OtpInput {
  email: string
  purpose: 'login' | 'signup' | 'recovery' | 'reauth' | 'verify-email'
  context?: string
  otp?: string
}
export function parseOtpInput(input: unknown, verify: boolean, purpose: string): OtpInput {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new AuthOperationFailure('INVALID_INPUT')
  const data = input as Record<string, unknown>
  if (
    Object.keys(data).some(
      (key) => !['email', 'purpose', 'context', ...(verify ? ['otp'] : [])].includes(key),
    ) ||
    typeof data.email !== 'string' ||
    data.email.length > 254 ||
    data.purpose !== purpose
  )
    throw new AuthOperationFailure('INVALID_INPUT')
  const email = data.email.trim().toLowerCase()
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    (data.context !== undefined &&
      (typeof data.context !== 'string' || !/^[a-f0-9]{64}$/.test(data.context))) ||
    (verify && (typeof data.otp !== 'string' || !/^\d{6}$/.test(data.otp) || !data.context))
  )
    throw new AuthOperationFailure('INVALID_INPUT')
  return {
    email,
    purpose: purpose as OtpInput['purpose'],
    context: data.context as string | undefined,
    otp: data.otp as string | undefined,
  }
}
