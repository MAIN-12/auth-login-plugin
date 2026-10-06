import { z } from 'zod'
import { AuthFailure } from '../auth/domain/login'
const email = z.string().max(254).transform(value => value.trim().toLowerCase()).pipe(z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))
const context = z.string().regex(/^[a-f0-9]{64}$/)
export const otpSendSchema = z.strictObject({ email, purpose: z.enum(['login', 'signup', 'recovery', 'reauth']), context: context.optional() })
export const otpVerifySchema = otpSendSchema.extend({ context, otp: z.string().regex(/^\d{6}$/) })
export const ownershipSendSchema = otpSendSchema.extend({ purpose: z.enum(['signup', 'recovery', 'reauth']) })
export const ownershipVerifySchema = ownershipSendSchema.extend({ context, otp: z.string().regex(/^\d{6}$/) })
export const forgotPasswordSchema = z.strictObject({ email, context: context.optional() })
export const reauthenticationSchema = z.strictObject({ password: z.string().min(1).max(1024) })
export const passwordCompletionSchema = z.strictObject({ permit: z.string().min(1).max(2048), password: z.string().min(1).max(1024) })
/** Interface failures reveal no schema details; semantic authorization remains in the application. */
export function parseAuthInterface<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) throw new AuthFailure('INVALID_INPUT', 400)
  return parsed.data
}
