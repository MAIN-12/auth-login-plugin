'use client'
import { AuthConfigContext } from '../AuthConfigProvider'
import React, { createContext, useContext } from 'react'
const SignupEnabledContext = createContext<boolean | undefined>(undefined)
export function AuthSignupConfig({
  enabled,
  children,
}: {
  enabled: boolean
  children: React.ReactNode
}) {
  return <SignupEnabledContext.Provider value={enabled}>{children}</SignupEnabledContext.Provider>
}
export function useAllowSignup(): boolean {
  const configured = useContext(SignupEnabledContext)
  const config = useContext(AuthConfigContext)
  return configured ?? config?.allowSignup ?? false
}
