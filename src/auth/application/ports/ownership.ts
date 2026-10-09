import type { CredentialCapabilities } from '../../domain/credentials'
export interface OwnershipAccount extends CredentialCapabilities {
  id: string | number
  email: string
  version: string
  state: 'active' | 'deleted' | 'unknown'
}
export interface OwnershipPrincipal {
  id: string | number
  sid?: string
}
import type { PasswordPermit } from '../../domain/passwordPermit'
export type { PasswordPermit } from '../../domain/passwordPermit'
export type OwnershipProof = Omit<PasswordPermit, 'purpose'> & {
  purpose: PasswordPermit['purpose'] | 'verify-email'
}
export interface PermitGrant {
  success: true
  permit: string
  expiresAt: number
}
export interface PasswordPermits {
  grant(permit: PasswordPermit): PermitGrant | Promise<PermitGrant>
  read(
    purpose: PasswordPermit['purpose'],
    encoded: string,
  ): PasswordPermit | Promise<PasswordPermit>
}
export interface CredentialCommit {
  (permit: PasswordPermit, password: string): Promise<{ success: boolean }>
}
export interface NativeReauthentication {
  (password: string): Promise<PasswordPermit>
}
