import type { AuthErrorCode } from '../../shared/domain/errors'
import type { PasswordCredentials } from '../../collections/ConfiguredAuthCollection/domain'
export type PasswordLoginCommand = PasswordCredentials
import type { Principal } from '../../collections/ConfiguredAuthCollection/domain'
export type { Principal } from '../../collections/ConfiguredAuthCollection/domain'
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
