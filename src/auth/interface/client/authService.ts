import { z } from 'zod'
import type { AuthErrorCode } from '../../domain/errors'
import { safeAuthRedirect } from '../../domain/redirect'
import type { PublicAuthConfig } from '../../../config'
import type { CredentialCapabilities } from '../../domain/credentials'
import type { ClientPasswordProof } from '../../application/services/passwordProof'
import type {
  SendOtpResponse,
  VerifyOtpResponse,
  SetPasswordResponse,
  SignupResponse,
} from '../../domain/types'

export class AuthRequestError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    public readonly status: number,
  ) {
    super(code)
  }
}

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
  const sent = success.extend({ context: z.string().min(1), retryAfter: z.number().nonnegative() })
  const proof = success.extend({
    permit: z.string().min(1).max(2048),
    expiresAt: z.number().finite(),
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
  return {
    reauthenticateGoogle(): Promise<ClientPasswordProof> {
      if (!config.googleOAuthEnabled)
        return Promise.reject(new AuthRequestError('METHOD_DISABLED', 403))
      let popup: Window | null
      try {
        popup = window.open(
          `${config.apiPrefix}${config.authEndpointPrefix}/oauth/google/reauthenticate?mode=popup`,
          '_blank',
          'popup,width=600,height=700',
        )
      } catch {
        return Promise.reject(new AuthRequestError('AUTH_UNAVAILABLE', 503))
      }
      if (!popup) return Promise.reject(new AuthRequestError('AUTH_UNAVAILABLE', 503))
      return new Promise((resolve, reject) => {
        const origin = window.location.origin
        const finish = (grant?: ClientPasswordProof) => {
          window.removeEventListener('message', receive)
          clearInterval(closed)
          clearTimeout(timeout)
          try {
            popup.close()
          } catch {
            reject(new AuthRequestError('AUTH_UNAVAILABLE', 503))
            return
          }
          if (grant) resolve(grant)
          else reject(new AuthRequestError('AUTH_FAILED', 401))
        }
        const receive = (event: MessageEvent) => {
          if (event.origin !== origin || event.source !== popup) return
          const message = z
            .object({
              type: z.literal('auth-login.google.reauthentication'),
              grant: z.object({
                success: z.literal(true),
                permit: z.string().min(1).max(2048),
                expiresAt: z.number().finite(),
              }),
            })
            .safeParse(event.data as unknown)
          if (!message.success) return
          const grant = message.data.grant
          if (grant.expiresAt <= Date.now() || grant.permit.length > 2048) return finish()
          finish({ purpose: 'reauth', permit: grant.permit, expiresAt: grant.expiresAt })
        }
        const closed = setInterval(() => {
          if (popup.closed) finish()
        }, 250)
        const timeout = setTimeout(() => finish(), 300000)
        window.addEventListener('message', receive)
      })
    },
    async linkGoogle(permit: string, returnTo = '/'): Promise<void> {
      if (!config.googleOAuthEnabled) throw new AuthRequestError('METHOD_DISABLED', 403)
      const result = await request(
        'oauth/google/link',
        { permit, confirm: true, returnTo: safeAuthRedirect(returnTo) },
        z.object({ url: z.string().url() }),
      )
      if (typeof result.url !== 'string') throw new AuthRequestError('AUTH_FAILED', 401)
      try {
        window.location.assign(result.url)
      } catch {
        throw new AuthRequestError('AUTH_UNAVAILABLE', 503)
      }
    },
    sendOtp: (email: string, context?: string): Promise<SendOtpResponse> =>
      config.otpLogin
        ? request('otp/send', { email, purpose: 'login', ...(context ? { context } : {}) }, sent)
        : Promise.reject(new AuthRequestError('METHOD_DISABLED', 403)),
    verifyOtp: (email: string, otp: string, context: string): Promise<VerifyOtpResponse> =>
      config.otpLogin
        ? request('otp/verify', { email, otp, context, purpose: 'login' }, success)
        : Promise.reject(new AuthRequestError('METHOD_DISABLED', 403)),
    sendOwnership: (
      email: string,
      purpose: 'signup' | 'recovery' | 'reauth' | 'verify-email',
      context?: string,
    ): Promise<SendOtpResponse> =>
      request('otp/send', { email, purpose, ...(context ? { context } : {}) }, sent),
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
export function initiateGoogleLogin(redirectTo = '/', config?: PublicAuthConfig): void {
  if (!config?.googleOAuthEnabled) throw new AuthRequestError('METHOD_DISABLED', 403)
  try {
    window.location.assign(
      `${config.apiPrefix}${config.authEndpointPrefix}/oauth/google?returnTo=${encodeURIComponent(safeAuthRedirect(redirectTo))}`,
    )
  } catch {
    throw new AuthRequestError('AUTH_UNAVAILABLE', 503)
  }
}

/** Error codes remain separate from presentation text; unknown errors use a safe key. */
export function authErrorKey(error: unknown): 'invalidCredentials' | 'genericError' {
  return error instanceof AuthRequestError && error.code === 'AUTH_FAILED'
    ? 'invalidCredentials'
    : 'genericError'
}
