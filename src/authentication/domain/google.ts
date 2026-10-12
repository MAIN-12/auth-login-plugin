export interface GoogleIdentity {
  sub: string
  email?: string
  emailVerified: boolean
  /** Workspace domain from the signature-validated ID token, never request parameters. */
  hostedDomain?: string
  authenticatedAt?: number
  amr?: string[]
}
export interface GooglePrincipal {
  id: string | number
  sid: string
  version: string
  email: string
}
