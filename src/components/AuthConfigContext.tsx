'use client'
import React, { createContext, useContext, useMemo } from 'react'
import {
  AuthServiceContext,
  createAuthServiceScope,
  matchesAuthTransport,
  type AuthServiceScope,
} from '../auth/interface/react/AuthServiceContext'
import type { PublicAuthConfig } from '../config'

export const AuthConfigContext = createContext<PublicAuthConfig | null>(null)
export function AuthConfigProvider({
  publicConfig,
  children,
  serviceScope,
}: {
  publicConfig: PublicAuthConfig
  children: React.ReactNode
  serviceScope?: AuthServiceScope
}) {
  const inheritedScope = useContext(AuthServiceContext)
  const scope = useMemo(
    () =>
      serviceScope ??
      (inheritedScope && matchesAuthTransport(inheritedScope, publicConfig)
        ? inheritedScope
        : createAuthServiceScope(publicConfig)),
    [serviceScope, inheritedScope, publicConfig],
  )
  // Whitelist scalar fields. Extra keys on a caller object never enter context.
  const {
    collection,
    apiPrefix,
    authEndpointPrefix,
    authBasePath,
    locale,
    style,
    logoUrl,
    projectName,
    passwordLogin,
    otpLogin,
    googleOAuthEnabled,
    allowSignup,
    recovery,
    modalLogin,
    routeRedirects,
  } = publicConfig
  const config = Object.freeze({
    collection,
    apiPrefix,
    authEndpointPrefix,
    authBasePath,
    locale,
    style,
    logoUrl,
    projectName,
    passwordLogin,
    otpLogin,
    googleOAuthEnabled,
    allowSignup,
    recovery,
    modalLogin,
    routeRedirects,
  })
  return (
    <AuthConfigContext.Provider value={config}>
      <AuthServiceContext.Provider value={scope}>{children}</AuthServiceContext.Provider>
    </AuthConfigContext.Provider>
  )
}
export function useAuthConfig(): PublicAuthConfig {
  const config = useContext(AuthConfigContext)
  if (!config)
    throw new Error(
      'Auth UI requires AuthProvider or AuthConfigProvider with explicit publicConfig',
    )
  return config
}
