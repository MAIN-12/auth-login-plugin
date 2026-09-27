'use client'

import React, { createContext, useContext } from 'react'
import { pluginConfig } from '../config'

const SignupEnabledContext = createContext<boolean | undefined>(undefined)

/** Internal server-to-client bridge; not a public component configuration API. */
export function AuthSignupConfig({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  return <SignupEnabledContext.Provider value={enabled}>{children}</SignupEnabledContext.Provider>
}

export function useAllowSignup(): boolean {
  return useContext(SignupEnabledContext) ?? pluginConfig.allowSignup
}
