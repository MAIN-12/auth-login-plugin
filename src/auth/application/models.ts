import type { AuthErrorCode } from '../domain/errors'
import type { PasswordCredentials } from '../domain/passwordLoginRules'
export type PasswordLoginCommand = PasswordCredentials
export interface Principal {
  accountID: string | number
  collection: string
  sid?: string
}
export type Outcome<T> = { ok: true; value: T } | { ok: false; code: AuthErrorCode }
export interface PasswordLoginResult {
  principal: Principal
}
