'use client'
import React, { createContext, useContext } from 'react'
const SignupEnabledContext = createContext(false)
export function AuthSignupConfig({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  return <SignupEnabledContext.Provider value={enabled}>{children}</SignupEnabledContext.Provider>
}
export function useAllowSignup(): boolean { return useContext(SignupEnabledContext) }
