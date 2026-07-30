// Auth domain types shared across the plugin

export type LoginStep = 'email' | 'password' | 'otp-prompt'
export type OTPPurpose = 'login' | 'signup' | 'password-reset'

export interface CheckEmailResponse {
  exists: boolean
  hasPassword: boolean
  authProvider: string | null
}

export interface SendOtpResponse {
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