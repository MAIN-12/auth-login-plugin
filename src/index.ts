import { createPasswordLoginEndpoint } from './auth/composition/passwordLogin'
import { createAdminPolicy } from './auth/server/adminPolicy'
import { createGoogleEndpoints } from './endpoints/googleEndpoints'
import type { Config } from 'payload'
import { resolveAuthConfig, type AuthLoginPluginOptions, type PublicAuthConfig } from './config'
import {
  createAuthEndpoints,
  createRefreshEndpoint,
  authFailureResponse,
} from './endpoints/authEndpoints'
import { installNativeSessionCoordination } from './auth/server/otpSession'
import { guardCredentialIntent } from './auth/server/credentialIntent'
import { createSessionPolicy } from './auth/server/sessionPolicy'
import { AuthFailure } from './auth/domain/login'

export type {
  AuthLoginPluginOptions,
  PublicAuthConfig,
  SerializableAuthConfig,
  AuthStyle,
  OtpOptions,
} from './config'
export type { AuthErrorCode, AuthErrorResponse } from './auth/domain/login'
export type { GoogleOptions } from './googleOptions'
export type { AdminOptions, AuthenticationEvidence } from './adminOptions'
export type { CredentialCapabilities } from './auth/domain/credentials'

/** Configuration is captured once per factory; no env or process-global bridge. */
type EnabledPlugin = ((config: Config) => Promise<Config>) & {
  readonly publicConfig: PublicAuthConfig
}
type DisabledPlugin = ((config: Config) => Promise<Config>) & { readonly publicConfig: null }
export function authLoginPlugin(options: { enabled: false }): DisabledPlugin
export function authLoginPlugin(options: AuthLoginPluginOptions): EnabledPlugin
export function authLoginPlugin(
  options: AuthLoginPluginOptions | { enabled: false },
): EnabledPlugin | DisabledPlugin {
  if (!options || typeof options !== 'object' || Array.isArray(options))
    throw new Error('auth-login: options must be an object')
  if (options.enabled === false)
    return Object.freeze(Object.assign(async (config: Config) => config, { publicConfig: null }))
  const publicConfig = resolveAuthConfig(options)
  const otpOptions = options.otp
    ? Object.freeze({
        ...options.otp,
        email: options.otp.email
          ? Object.freeze({
              ...options.otp.email,
              locale: publicConfig.locale ?? 'en',
              projectName: options.otp.email.projectName ?? publicConfig.projectName,
              logoUrl:
                options.otp.email.logoUrl ??
                (publicConfig.logoUrl?.startsWith('https://') ? publicConfig.logoUrl : undefined),
              colors: options.otp.email.colors
                ? Object.freeze({ ...options.otp.email.colors })
                : undefined,
            })
          : undefined,
      })
    : undefined
  const googleOptions =
    options.providers.google === false ? undefined : Object.freeze({ ...options.providers.google })
  createAdminPolicy(options.admin)
  const frozenAdmin = options.admin
    ? {
        ...options.admin,
        collections: options.admin.collections.map((resource) => ({
          ...resource,
          operations: [...resource.operations],
        })),
        globals: options.admin.globals?.map((resource) => ({
          ...resource,
          operations: [...resource.operations],
        })),
      }
    : undefined
  const maxAge = options.session?.maxAge ?? 7200
  const plugin = async (config: Config): Promise<Config> => {
    if (config.routes?.api && config.routes.api !== publicConfig.apiPrefix)
      throw new Error('auth-login: apiPrefix conflicts with Payload routes.api')
    if (
      config.collections?.some(
        (collection) => publicConfig.authEndpointPrefix.split('/')[1] === collection.slug,
      )
    )
      throw new Error('auth-login: authEndpointPrefix conflicts with collection')
    const target = config.collections?.find(
      (collection) => collection.slug === publicConfig.collection,
    )
    if (
      !target?.auth ||
      typeof target.auth !== 'object' ||
      target.auth.useSessions !== true ||
      target.auth.disableLocalStrategy ||
      target.auth.loginWithUsername
    )
      throw new Error(
        'auth-login: target requires explicit auth.useSessions=true and email local strategy',
      )
    if (target.auth.useAPIKey || target.auth.strategies?.length)
      throw new Error(
        'auth-login: target cannot enable API keys or alternative auth strategies in password-only release',
      )
    if (!target.auth.verify)
      throw new Error(
        'auth-login: target requires auth.verify=true; provision verified evidence explicitly',
      )
    if (
      target.auth.tokenExpiration !== undefined &&
      (!Number.isSafeInteger(target.auth.tokenExpiration) || target.auth.tokenExpiration < 1)
    )
      throw new Error('auth-login: invalid tokenExpiration')
    const tokenExpiration = Math.min(target.auth.tokenExpiration ?? 7200, maxAge)
    if (!Number.isSafeInteger(tokenExpiration) || tokenExpiration < 1)
      throw new Error('auth-login: invalid tokenExpiration')
    const originalAdmin = target.access?.admin
    const adminPolicy = createAdminPolicy(frozenAdmin, originalAdmin)
    const assertPublicAccount = async (req: Parameters<typeof authFailureResponse>[1]) => {
      if (!originalAdmin || (await originalAdmin({ req })) !== false)
        throw new AuthFailure('AUTH_FAILED', 401)
    }
    const policy = createSessionPolicy(
      publicConfig.collection,
      tokenExpiration,
      publicConfig.passwordLogin,
      assertPublicAccount,
    )
    const disabled = (path: string) => ({
      path: `/${path}`,
      method: 'post' as const,
      handler: (req: Parameters<typeof authFailureResponse>[1]) =>
        authFailureResponse(new AuthFailure('METHOD_DISABLED', 403), req),
    })
    return adminPolicy.protect({
      ...config,
      routes: { ...config.routes, api: publicConfig.apiPrefix },
      onInit: async (payload) => {
        await config.onInit?.(payload)
        installNativeSessionCoordination(payload, publicConfig.collection)
        policy.installStrategy(payload)
      },
      endpoints: [
        ...createAuthEndpoints(publicConfig, otpOptions, assertPublicAccount),
        ...createGoogleEndpoints(publicConfig, googleOptions, otpOptions?.now, assertPublicAccount),
        ...(config.endpoints ?? []),
      ],
      collections: config.collections?.map((collection) =>
        collection !== target
          ? collection
          : {
              ...target,
              auth: { ...(target.auth as object), tokenExpiration },
              access: {
                ...target.access,
                admin: async (args) => adminPolicy.permits(args.req),
                create: (args) => (args.req.user ? (target.access?.create?.(args) ?? true) : false),
              },
              hooks: {
                ...target.hooks,
                beforeChange: [...(target.hooks?.beforeChange ?? []), guardCredentialIntent],
                beforeLogin: [
                  ...(target.hooks?.beforeLogin ?? []),
                  ({ user }) => {
                    if (user._verified !== true) throw new AuthFailure('AUTH_FAILED', 401)
                    return user
                  },
                ],
                beforeOperation: [...(target.hooks?.beforeOperation ?? []), policy.beforeOperation],
                afterOperation: [...(target.hooks?.afterOperation ?? []), policy.afterOperation],
              },
              endpoints: [
                createPasswordLoginEndpoint(publicConfig, '/login'),
                createRefreshEndpoint(publicConfig),
                ...['forgot-password', 'reset-password', 'first-register'].map(disabled),
                ...(target.endpoints || []),
              ],
            },
      ),
    })
  }
  return Object.freeze(Object.assign(plugin, { publicConfig }))
}

/** Unforgeable request-local method evidence for consumer server hooks, never a client capability. */
export { isOtpSessionRequest } from './auth/server/otpSession'

export { getAuthenticationEvidence } from './auth/server/adminPolicy'

/** Offline, account-preserving maintenance cutoff; never exposed through HTTP. */
export { migrateAuthLogin, type AuthLoginMigrationOptions } from './auth/server/migration'
