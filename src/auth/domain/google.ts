export interface GoogleIdentity {
  sub: string
  email?: string
  emailVerified: boolean
  authenticatedAt?: number
  amr?: string[]
}
export interface GoogleCorrelation {
  state: string
  nonce: string
  verifier: string
  browser: string
  returnTo: string
  expiresAt: number
  purpose: 'login' | 'link' | 'reauth'
  permit?: string
  popup?: boolean
  principal?: { id: string | number; sid: string; version: string; email: string }
}
