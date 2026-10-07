'use client'
import React, { createContext, useContext } from 'react'
import type { PublicAuthConfig } from '../config'

export const AuthConfigContext = createContext<PublicAuthConfig | null>(null)
export function AuthConfigProvider({ publicConfig, children }: { publicConfig: PublicAuthConfig; children: React.ReactNode }) {
  // Whitelist scalar fields. Extra keys on a caller object never enter context.
  const { collection, apiPrefix, authEndpointPrefix, authBasePath, locale, style, logoUrl, projectName,
    passwordLogin, otpLogin, googleOAuthEnabled, allowSignup, recovery, modalLogin, routeRedirects } = publicConfig
  const config = Object.freeze({ collection, apiPrefix, authEndpointPrefix, authBasePath, locale, style, logoUrl, projectName,
    passwordLogin, otpLogin, googleOAuthEnabled, allowSignup, recovery, modalLogin, routeRedirects })
  return <AuthConfigContext.Provider value={config}>{children}</AuthConfigContext.Provider>
}
export function useAuthConfig(): PublicAuthConfig {
  const config = useContext(AuthConfigContext)
  if (!config) throw new Error('Auth UI requires AuthProvider or AuthConfigProvider with explicit publicConfig')
  return config
}
