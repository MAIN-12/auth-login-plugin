import type { CredentialCapabilities } from './credentials'
export interface OwnershipAccount extends CredentialCapabilities {
  id: string | number
  email: string
  version: string
  state: 'active' | 'deleted' | 'unknown'
}

export interface Principal {
  accountID: string | number
  collection: string
  sid?: string
}
