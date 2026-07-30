'use client'

import { initClientConfig } from '@main12/auth-login/client'
import type { AuthStyle } from '@main12/auth-login'

// Mirrors the server-side Payload plugin config on the client.
export function AuthClientInit({ style, googleOAuthEnabled }: { style: AuthStyle; googleOAuthEnabled?: boolean }) {
  initClientConfig({ style, googleOAuthEnabled })
  return null
}
