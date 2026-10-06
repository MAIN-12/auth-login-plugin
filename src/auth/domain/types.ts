// Auth domain types shared across the plugin

export type LoginStep = 'email' | 'password' | 'otp-prompt'
export type OTPPurpose = 'login' | 'signup' | 'password-reset'

/** @deprecated Public account discovery has no successful response. */
export type CheckEmailResponse = never

export interface SendOtpResponse {
  context?: string
  retryAfter?: number
  code?: string
  success: boolean
  message?: string
}

export interface VerifyOtpResponse {
  success: boolean
  token?: string
  error?: string
  isNewUser?: boolean
}

export interface SetPasswordResponse {
  success: boolean
  message?: string
}

export interface SignupResponse {
  success: boolean
  message?: string
  userId?: string
}

export interface PasswordStrengthResult {
  score: number // 0-5
  hasMinLength: boolean
  hasUppercase: boolean
  hasLowercase: boolean
  hasNumber: boolean
  hasSpecial: boolean
  isValid: boolean
}