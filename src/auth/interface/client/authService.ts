import { AuthRequestError } from './authRequestError'
export { AuthRequestError } from './authRequestError'
import { createGoogleActions } from './googleActions'
export { initiateGoogleLogin } from './googleActions'
import { z } from 'zod'
import type { PublicAuthConfig } from '../../../config'
import type { CredentialCapabilities } from '../../domain/credentials'
import type { ClientPasswordProof } from '../../application/services/passwordProof'
import type {
  SendOtpResponse,
  VerifyOtpResponse,
  SetPasswordResponse,
  SignupResponse,
} from '../../domain/types'

/** Explicit per-tree HTTP adapter; no module-global options or account discovery. */
export function createAuthService(config: PublicAuthConfig, locale?: string) {
  config = Object.freeze({ ...config })
  const codes = [
    'INVALID_INPUT',
    'AUTH_FAILED',
    'METHOD_DISABLED',
    'UNAUTHENTICATED',
    'AUTH_UNAVAILABLE',
    'ORIGIN_DENIED',
  ] as const
  const success = z.object({ success: z.literal(true) })
  const otpVerified = success.extend({
    user: z.object({ id: z.union([z.string().min(1), z.number().finite()]) }),
    exp: z
      .number()
      .finite()
      .refine((exp) => exp > Date.now() / 1000),
  })
  const otpSent = success.extend({
    context: z.string().regex(/^[a-f0-9]{64}$/),
    retryAfter: z.number().finite().int().positive(),
  })
  const proof = success.extend({
    permit: z.string().min(1).max(2048),
    expiresAt: z
      .number()
      .finite()
      .refine((expiresAt) => expiresAt > Date.now()),
  })
  const request = async <T>(
    action: string,
    body: unknown,
    schema: z.ZodType<T>,
    method = 'POST',
  ): Promise<T> => {
    let response: Response
    try {
      response = await fetch(
        `${config.apiPrefix}${action.startsWith('/') ? action : `${config.authEndpointPrefix}/${action}`}`,
        {
          method,
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Accept-Language':
              locale === 'es' || locale === 'en' ? locale : (config.locale ?? 'en'),
          },
          ...(method === 'POST' ? { body: JSON.stringify(body) } : { cache: 'no-store' as const }),
        },
      )
    } catch {
      throw new AuthRequestError('AUTH_UNAVAILABLE', 503)
    }
    let data: unknown
    try {
      data = await response.json()
    } catch {
      throw new AuthRequestError(
        response.status >= 500 ? 'AUTH_UNAVAILABLE' : 'AUTH_FAILED',
        response.status,
      )
    }
    if (!response.ok) {
      const failure = z.object({ code: z.enum(codes) }).safeParse(data)
      throw new AuthRequestError(
        failure.success
          ? failure.data.code
          : response.status >= 500
            ? 'AUTH_UNAVAILABLE'
            : 'AUTH_FAILED',
        response.status,
      )
    }
    const parsed = schema.safeParse(data)
    if (!parsed.success) throw new AuthRequestError('AUTH_UNAVAILABLE', 503)
    return parsed.data
  }
  const sessionUser = z
    .object({ id: z.union([z.string().min(1), z.number().finite()]), email: z.string().optional() })
    .passthrough()
  type SessionUser = z.infer<typeof sessionUser>
  let sessionFlight: Promise<SessionUser | null> | undefined
  let logoutFlight: Promise<void> | undefined
  const session = (): Promise<SessionUser | null> => {
    if (sessionFlight) return sessionFlight
    sessionFlight = (async () => {
      const response = await fetch(`${config.apiPrefix}/${config.collection}/me`, {
        credentials: 'include',
        cache: 'no-store',
      })
      if (response.status === 401) return null
      if (!response.ok) throw new Error('Unable to load the current session')
      let data: unknown
      try {
        data = await response.json()
      } catch {
        throw new Error('Unable to load the current session')
      }
      const parsed = z.object({ user: sessionUser.nullable() }).safeParse(data)
      if (!parsed.success) throw new Error('Unable to load the current session')
      return parsed.data.user
    })().finally(() => {
      sessionFlight = undefined
    })
    return sessionFlight
  }
  const logout = (): Promise<void> => {
    if (logoutFlight) return logoutFlight
    logoutFlight = (async () => {
      const response = await fetch(`${config.apiPrefix}/${config.collection}/logout`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Logout failed')
    })().finally(() => {
      logoutFlight = undefined
    })
    return logoutFlight
  }
  return {
    ...createGoogleActions(config, request),
    session,
    logout,
    sendOtp: (email: string, context?: string): Promise<SendOtpResponse> =>
      config.otpLogin
        ? request('otp/send', { email, purpose: 'login', ...(context ? { context } : {}) }, otpSent)
        : Promise.reject(new AuthRequestError('METHOD_DISABLED', 403)),
    verifyOtp: (email: string, otp: string, context: string): Promise<VerifyOtpResponse> =>
      config.otpLogin
        ? request('otp/verify', { email, otp, context, purpose: 'login' }, otpVerified)
        : Promise.reject(new AuthRequestError('METHOD_DISABLED', 403)),
    sendOwnership: (
      email: string,
      purpose: 'signup' | 'recovery' | 'reauth' | 'verify-email',
      context?: string,
    ): Promise<SendOtpResponse> =>
      request('otp/send', { email, purpose, ...(context ? { context } : {}) }, otpSent),
    verifyEmail: (email: string, otp: string, context: string): Promise<{ success: true }> =>
      request('otp/verify', { email, otp, context, purpose: 'verify-email' }, success),
    verifyOwnership: async (
      email: string,
      purpose: 'signup' | 'recovery' | 'reauth',
      otp: string,
      context: string,
    ): Promise<ClientPasswordProof> => ({
      ...(await request('otp/verify', { email, purpose, otp, context }, proof)),
      purpose,
    }),
    reauthenticate: async (password: string): Promise<ClientPasswordProof> => ({
      ...(await request('reauthenticate', { password }, proof)),
      purpose: 'reauth',
    }),
    completePassword: (
      proof: ClientPasswordProof,
      password: string,
    ): Promise<SetPasswordResponse> =>
      request(
        proof.purpose === 'signup'
          ? 'signup'
          : proof.purpose === 'recovery'
            ? 'reset-password'
            : 'set-password',
        { permit: proof.permit, password },
        success,
      ),
    async principal(): Promise<{ email: string }> {
      return (
        await request(
          `/${config.collection}/me`,
          undefined,
          z.object({ user: z.object({ email: z.string().email() }) }),
          'GET',
        )
      ).user
    },
    async login(credentials: { email: string; password: string }): Promise<void> {
      if (!config.passwordLogin) throw new AuthRequestError('METHOD_DISABLED', 403)
      await request('login', credentials, success)
    },
    async credentials(): Promise<CredentialCapabilities> {
      return (
        await request(
          'credentials',
          undefined,
          z.object({
            capabilities: z.object({
              password: z.enum(['available', 'unavailable', 'unknown']),
              emailVerification: z.enum(['verified', 'unverified', 'unknown']),
            }),
          }),
          'GET',
        )
      ).capabilities
    },
  }
}
const unavailable = async (): Promise<never> => {
  throw new AuthRequestError('METHOD_DISABLED', 403)
}
/** @deprecated Public account discovery is permanently unavailable. */
export const checkEmail = unavailable
/** Disabled until dedicated hardened implementations are released. No transport effects. */
export async function sendOtp(
  _email: string,
  _purpose?: 'login' | 'signup' | 'password-reset',
): Promise<SendOtpResponse> {
  return unavailable()
}
export async function verifyOtp(_email: string, _otp: string): Promise<VerifyOtpResponse> {
  return unavailable()
}
export async function setUserPassword(
  _password: string,
  _confirmPassword: string,
): Promise<SetPasswordResponse> {
  return unavailable()
}
export async function signup(_name: string, _email: string): Promise<SignupResponse> {
  return unavailable()
}
/** Error codes remain separate from presentation text; unknown errors use a safe key. */
export function authErrorKey(error: unknown): 'invalidCredentials' | 'genericError' {
  return error instanceof AuthRequestError && error.code === 'AUTH_FAILED'
    ? 'invalidCredentials'
    : 'genericError'
}
