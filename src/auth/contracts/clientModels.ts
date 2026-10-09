// Auth domain types shared across the plugin

export type LoginStep = 'email' | 'password' | 'otp-prompt'
export type OTPPurpose = 'login' | 'signup' | 'password-reset'

/** @deprecated Public account discovery has no successful response. */
export type CheckEmailResponse = never

import type { AuthErrorResponse } from './errors'
export type SendOtpResponse =
  { success: true; context: string; retryAfter: number } | (AuthErrorResponse & { message?: never })
export type VerifyOtpResponse = { success: true } | (AuthErrorResponse & { error?: never })
export type SetPasswordResponse = { success: true } | (AuthErrorResponse & { message?: never })
export type SignupResponse = SetPasswordResponse
