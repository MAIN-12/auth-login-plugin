import { z } from 'zod'
import { AuthRequestError } from './authRequestError'
import { safeAuthRedirect } from '../../domain/redirect'
import type { PublicAuthConfig } from '../../contracts/publicConfig'
import type { ClientPasswordProof } from './passwordProof'

export function createGoogleActions(
  config: PublicAuthConfig,
  request: <T>(action: string, body: unknown, schema: z.ZodType<T>) => Promise<T>,
) {
  let inFlight = false
  const run = <T>(work: () => Promise<T>): Promise<T> => {
    if (!config.googleOAuthEnabled)
      return Promise.reject(new AuthRequestError('METHOD_DISABLED', 403))
    if (inFlight) return Promise.reject(new AuthRequestError('AUTH_UNAVAILABLE', 503))
    inFlight = true
    try {
      return work().finally(() => {
        inFlight = false
      })
    } catch (error) {
      inFlight = false
      return Promise.reject(error)
    }
  }
  const actions = {
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
  }
  return {
    loginGoogle: (returnTo = '/') => {
      if (!config.googleOAuthEnabled) throw new AuthRequestError('METHOD_DISABLED', 403)
      if (inFlight) throw new AuthRequestError('AUTH_UNAVAILABLE', 503)
      initiateGoogleLogin(returnTo, config)
    },
    linkGoogle: (permit: string, returnTo = '/') => run(() => actions.linkGoogle(permit, returnTo)),
    reauthenticateGoogle: () => run(() => actions.reauthenticateGoogle()),
  }
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
