'use client'
import { createContext, useContext, useMemo } from 'react'
import { useAuthPresentation } from '../../../contexts/AuthAppearanceContext'
import { normalizeAuthLocale } from '../../../i18n/locale'
import type { PublicAuthConfig } from '../../contracts/publicConfig'
import { createAuthService } from '../client/authService'
import { useAuthConfig } from './providers/AuthConfigProvider'

export type AuthService = ReturnType<typeof createAuthService>
export function createAuthServiceScope(config: PublicAuthConfig) {
  const snapshot: PublicAuthConfig = Object.freeze({
    collection: config.collection,
    apiPrefix: config.apiPrefix,
    authEndpointPrefix: config.authEndpointPrefix,
    authBasePath: config.authBasePath,
    locale: config.locale,
    style: config.style,
    logoUrl: config.logoUrl,
    projectName: config.projectName,
    passwordLogin: config.passwordLogin,
    otpLogin: config.otpLogin,
    googleOAuthEnabled: config.googleOAuthEnabled,
    allowSignup: config.allowSignup,
    recovery: config.recovery,
    modalLogin: config.modalLogin,
    routeRedirects: config.routeRedirects,
  })
  const services = new Map<string, AuthService>()
  return {
    config: snapshot,
    forLocale(locale?: string) {
      const key = normalizeAuthLocale(locale, snapshot.locale ?? 'en')
      let service = services.get(key)
      if (!service) {
        service = createAuthService(snapshot, key)
        services.set(key, service)
      }
      return service
    },
  }
}
export type AuthServiceScope = ReturnType<typeof createAuthServiceScope>
export const AuthServiceContext = createContext<AuthServiceScope | null>(null)
/** Language, UI base paths and branding do not change transport authority. Native routes and methods do. */
export function matchesAuthTransport(scope: AuthServiceScope, config: PublicAuthConfig) {
  return (
    scope.config.collection === config.collection &&
    scope.config.apiPrefix === config.apiPrefix &&
    scope.config.authEndpointPrefix === config.authEndpointPrefix &&
    scope.config.passwordLogin === config.passwordLogin &&
    scope.config.otpLogin === config.otpLogin &&
    scope.config.googleOAuthEnabled === config.googleOAuthEnabled &&
    scope.config.allowSignup === config.allowSignup &&
    scope.config.recovery === config.recovery
  )
}
export function useAuthService(locale?: string): AuthService {
  const config = useAuthConfig()
  const shared = useContext(AuthServiceContext)
  const presentation = useAuthPresentation({ locale })
  const scope = useMemo(
    () =>
      shared && matchesAuthTransport(shared, config) ? shared : createAuthServiceScope(config),
    [shared, config],
  )
  // Resolve against the current tree's default, not a shared scope's captured fallback.
  return scope.forLocale(normalizeAuthLocale(presentation.locale, config.locale ?? 'en'))
}
