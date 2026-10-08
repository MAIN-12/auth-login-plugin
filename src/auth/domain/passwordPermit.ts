export interface PasswordPermit {
  purpose: 'signup' | 'recovery' | 'reauth'
  email: string
  account: string | number | null
  version: string
  nonce?: string
  expiresAt?: number
  sid?: string
}
