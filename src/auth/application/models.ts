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

export interface OtpSendCommand {
  email: string
  purpose: 'login'
  context?: string
}
export interface OtpVerifyCommand extends OtpSendCommand {
  context: string
  otp: string
}

export interface OwnershipSendCommand {
  email: string
  purpose: 'signup' | 'recovery' | 'reauth' | 'verify-email'
  context?: string
}
export interface OwnershipVerifyCommand extends OwnershipSendCommand {
  context: string
  otp: string
}
export interface PasswordCompletionCommand {
  permit: string
  password: string
}
export interface PasswordReauthenticationCommand {
  password: string
}
