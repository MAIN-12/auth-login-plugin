import { setAuthenticationEvidence, getAuthenticationEvidence } from './adminPolicy'
import { isCredentialRequest, isReauthenticationRequest } from './credentialRequest'
import { isProvenSessionRequest } from './otpSession'
import {
  APIError,
  type CollectionAfterOperationHook as AfterOperationHook,
  type CollectionBeforeOperationHook as BeforeOperationHook,
  type Payload,
  type PayloadRequest,
} from 'payload'
import { decodeJwt, decodeProtectedHeader, jwtVerify, SignJWT } from 'jose'
import { parseCookies } from 'payload/shared'
import { parsePasswordCredentials } from '../domain/login'

interface Session {
  id: string
  createdAt: string | Date
  expiresAt: string | Date
}
/** Native Payload session storage is deliberately used, never a parallel session system. */
export function createSessionPolicy(
  collection: string,
  lifetime: number,
  passwordEnabled = true,
  assertOriginalAdminDenied?: (req: PayloadRequest) => Promise<void>,
) {
  const requestCaps = new WeakMap<PayloadRequest, number>()
  const beforeOperation: BeforeOperationHook = async ({ operation, args, req }) => {
    if (operation === 'create' || operation === 'update') {
      const writeArgs = args as { data?: unknown; overrideAccess?: boolean }
      const data = writeArgs.data
      const mutatesCredentials =
        data !== null &&
        typeof data === 'object' &&
        ['password', 'confirmPassword', 'hash', 'salt', '_verified', '_verificationToken'].some(
          (key) => Object.prototype.hasOwnProperty.call(data, key),
        )
      // Server-only credential provisioning is deliberately explicit. A REST/GraphQL
      // request remains untrusted even when a host forwards it to privileged Local API.
      const privilegedProvisioning =
        req.payloadAPI === 'local' &&
        writeArgs.overrideAccess === true &&
        req.context.authLoginCredentialProvisioning === true
      // Email ownership belongs to the address, not the account's old _verified flag.
      // Until a dedicated ownership-change workflow exists, reject every untrusted
      // update containing email (even no-ops), including bulk/native operations.
      if (
        operation === 'update' &&
        data !== null &&
        typeof data === 'object' &&
        Object.prototype.hasOwnProperty.call(data, 'email') &&
        !privilegedProvisioning
      )
        throw new APIError('METHOD_DISABLED', 403)
      if (mutatesCredentials && !privilegedProvisioning && !isCredentialRequest(req))
        throw new APIError('METHOD_DISABLED', 403)
      const mutatesSessionAuthority =
        data !== null &&
        typeof data === 'object' &&
        ['sessions', '_sid', '_strategy', 'authLoginMethod', 'authAuthenticatedAt', 'authAmr'].some(
          (key) => Object.prototype.hasOwnProperty.call(data, key),
        )
      if (mutatesSessionAuthority && !privilegedProvisioning && !isCredentialRequest(req))
        throw new APIError('METHOD_DISABLED', 403)
    }
    if (operation === 'forgotPassword' || operation === 'resetPassword')
      throw new APIError('METHOD_DISABLED', 403)
    if (operation === 'login' && !isProvenSessionRequest(req)) {
      if (!passwordEnabled) throw new APIError('METHOD_DISABLED', 403)
      // Guard Local API/GraphQL as well as custom HTTP. Hooks cannot manufacture another method.
      const loginArgs = args as Parameters<typeof import('payload').loginOperation>[0]
      loginArgs.data = parsePasswordCredentials(loginArgs.data)
    }
    if (operation !== 'refresh') return args
    if (!req.user || req.user.collection !== collection || !req.user._sid)
      throw new APIError('AUTH_FAILED', 401)
    // Explicit privileged native auth-storage read, only for the authenticated principal/session.
    const user = await req.payload.db.findOne({
      collection,
      req,
      where: { id: { equals: req.user.id } },
      select: { sessions: true },
    })
    const session = (
      (user as { sessions?: Session[] } | null)?.sessions as Session[] | undefined
    )?.find((session) => session.id === req.user!._sid)
    const cap = session ? Math.floor(new Date(session.createdAt).getTime() / 1000) + lifetime : NaN
    const now = Math.floor(Date.now() / 1000)
    if (
      !Number.isFinite(cap) ||
      cap <= now ||
      !session ||
      !Number.isFinite(new Date(session.expiresAt).getTime()) ||
      new Date(session.expiresAt).getTime() <= Date.now()
    )
      throw new APIError('AUTH_FAILED', 401)
    requestCaps.set(req, cap)
    const refreshArgs = args as Parameters<typeof import('payload').refreshOperation>[0]
    // Clone request-local args; never mutate the shared collection while requests overlap.
    return {
      ...refreshArgs,
      collection: {
        ...refreshArgs.collection,
        config: {
          ...refreshArgs.collection.config,
          auth: {
            ...refreshArgs.collection.config.auth,
            tokenExpiration: Math.min(lifetime, cap - now),
          },
        },
      },
    }
  }
  const afterOperation: AfterOperationHook = async ({ operation, result, req }) => {
    if (operation !== 'login' && operation !== 'refresh') return result
    if (operation === 'login' && isReauthenticationRequest(req)) return result
    const authResult = result as {
      user?: Record<string, unknown>
      exp?: number
      token?: string
      refreshedToken?: string
    }
    const token = operation === 'login' ? authResult.token : authResult.refreshedToken
    if (!token) throw new APIError('AUTH_FAILED', 401)
    const claims = decodeJwt(token)
    if (
      claims.collection !== collection ||
      typeof claims.sid !== 'string' ||
      (typeof claims.id !== 'number' && typeof claims.id !== 'string')
    )
      throw new APIError('AUTH_FAILED', 401)
    const user = await req.payload.db.findOne({
      collection,
      req,
      where: { id: { equals: claims.id } },
      select: { sessions: true },
    })
    const sessions = (user as { sessions?: Session[] } | null)?.sessions as Session[] | undefined
    const session = sessions?.find((session) => session.id === claims.sid)
    const cap = Math.min(
      requestCaps.get(req) ?? Infinity,
      session ? Math.floor(new Date(session.createdAt).getTime() / 1000) + lifetime : NaN,
    )
    if (!Number.isFinite(cap) || cap <= Math.floor(Date.now() / 1000) || !session)
      throw new APIError('AUTH_FAILED', 401)
    const expiration = Math.min(typeof claims.exp === 'number' ? claims.exp : cap, cap)
    const { iat: _iat, exp: _exp, ...fieldsToSign } = claims
    if (operation === 'login' && !isProvenSessionRequest(req)) {
      fieldsToSign.authLoginMethod = 'password'
      fieldsToSign.authAuthenticatedAt = Date.now()
      delete fieldsToSign.authAmr
    }
    const proof = operation === 'refresh' ? getAuthenticationEvidence(req) : undefined
    if (operation === 'refresh' && !proof) throw new APIError('AUTH_FAILED', 401)
    const signedToken = await new SignJWT({
      ...fieldsToSign,
      ...(proof
        ? {
            authLoginMethod: proof.method,
            authAuthenticatedAt: proof.authenticatedAt,
            authAmr: proof.amr,
          }
        : {}),
      iat: Math.floor(Date.now() / 1000),
      exp: expiration,
    })
      .setProtectedHeader({ ...decodeProtectedHeader(token), alg: 'HS256' })
      .sign(new TextEncoder().encode(req.payload.secret))
    if (new Date(session.expiresAt).getTime() > expiration * 1000) {
      session.expiresAt = new Date(expiration * 1000)
      // Native sessions may contain other valid sessions; preserve them.
      await req.payload.db.updateOne({
        collection,
        id: claims.id,
        data: { sessions },
        req,
        returning: false,
      })
    }
    return {
      ...authResult,
      exp: expiration,
      ...(operation === 'login' ? { token: signedToken } : { refreshedToken: signedToken }),
    } as typeof result
  }
  /** Wrap the built-in strategy in this Payload instance; preserve all host hooks/CSRF extraction. */
  function installStrategy(payload: Payload) {
    if (!payload.authStrategies.some((strategy) => strategy.name === 'local-jwt'))
      throw new Error('auth-login: native JWT strategy missing during initialization')
    payload.authStrategies = payload.authStrategies.map((strategy) => ({
      ...strategy,
      authenticate: async (args) => {
        const result = await strategy.authenticate(args)
        const user = result.user
        if (user?.collection !== collection) return result
        if (strategy.name !== 'local-jwt' || user._verified !== true)
          return { ...result, user: null }
        const sessions = user.sessions as Session[] | undefined
        const session = sessions?.find((session) => session.id === user._sid)
        const cap = session
          ? Math.floor(new Date(session.createdAt).getTime() / 1000) + lifetime
          : NaN
        if (
          !session ||
          !Number.isFinite(cap) ||
          cap <= Math.floor(Date.now() / 1000) ||
          !Number.isFinite(new Date(session.expiresAt).getTime()) ||
          new Date(session.expiresAt).getTime() <= Date.now()
        )
          return { ...result, user: null }
        // Follow native JWT precedence/CSRF, then verify the exact session identity again.
        // Never trust method values from a database field, HTTP body or request context.
        try {
          const token = nativeToken(args.headers, payload)
          if (!token) return { ...result, user: null }
          const { payload: claims } = await jwtVerify(
            token,
            new TextEncoder().encode(payload.secret),
          )
          if (claims.id !== user.id || claims.collection !== collection || claims.sid !== user._sid)
            return { ...result, user: null }
          user.authLoginMethod =
            claims.authLoginMethod === 'otp'
              ? 'otp'
              : claims.authLoginMethod === 'google'
                ? 'google'
                : 'password'
          user.authAuthenticatedAt =
            typeof claims.authAuthenticatedAt === 'number' ? claims.authAuthenticatedAt : undefined
          user.authAmr =
            Array.isArray(claims.authAmr) &&
            claims.authAmr.every((value) => typeof value === 'string')
              ? claims.authAmr
              : undefined
          if (args.req) {
            args.req.user = user
            setAuthenticationEvidence(args.req, {
              method: user.authLoginMethod as 'password' | 'otp' | 'google',
              authenticatedAt: user.authAuthenticatedAt as number | undefined,
              amr: user.authAmr as string[] | undefined,
            })
          }
          if (user.authLoginMethod === 'otp') {
            if (!args.req) return { ...result, user: null }
            await assertOriginalAdminDenied?.(args.req)
            if (
              !args.req ||
              (await payload.collections[collection].config.access.admin?.({
                req: { ...args.req, user } as PayloadRequest,
              })) !== false
            )
              return { ...result, user: null }
          }
        } catch {
          return { ...result, user: null }
        }
        return result
      },
    }))
  }
  return { beforeOperation, afterOperation, installStrategy }
}

/** Pinned Payload3.90 native extraction semantics, using the public cookie parser. */
function nativeToken(headers: Headers, payload: Payload): string | null {
  const authorization = headers.get('Authorization')
  for (const method of payload.config.auth.jwtOrder) {
    if (method === 'Bearer' && authorization?.startsWith('Bearer ')) return authorization.slice(7)
    if (method === 'JWT' && authorization?.startsWith('JWT ')) return authorization.slice(4)
    if (method === 'cookie') {
      const token = parseCookies(headers).get(`${payload.config.cookiePrefix}-token`)
      if (!token) continue
      const origin = headers.get('Origin')
      const site = headers.get('Sec-Fetch-Site')
      const allowed = origin
        ? !payload.config.csrf.length || payload.config.csrf.includes(origin)
        : !payload.config.csrf.length || ['same-origin', 'same-site', 'none'].includes(site ?? '')
      if (allowed) return token
    }
  }
  return null
}
