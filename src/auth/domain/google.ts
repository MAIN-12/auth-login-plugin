export interface GoogleIdentity {
  sub: string
  email?: string
  emailVerified: boolean
  authenticatedAt?: number
  amr?: string[]
}
export interface GooglePrincipal {
  id: string | number
  sid: string
  version: string
  email: string
}
