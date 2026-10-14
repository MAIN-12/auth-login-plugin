export type { OwnershipAccount } from '../../../collections/ConfiguredAuthCollection/domain'
export interface OwnershipPrincipal {
  id: string | number
  sid?: string
}
import type { PasswordPermit } from '../../../collections/AuthLoginPasswordPermits/domain'
export type { PasswordPermit } from '../../../collections/AuthLoginPasswordPermits/domain'
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
