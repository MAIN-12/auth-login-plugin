import type {
  CheckEmailResponse,
  SendOtpResponse,
  VerifyOtpResponse,
  SetPasswordResponse,
  SignupResponse,
} from '../../domain/types'

const API_PREFIX = '/api/auth'

/**
 * Check if a user exists and whether they have a password set.
 * Used in the two-step login flow.
 */
export async function checkEmail(email: string): Promise<CheckEmailResponse> {
  const response = await fetch(`${API_PREFIX}/check-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim() }),
  })
  return response.json()
}

/**
 * Send an OTP verification code to the user's email.
 */
export async function sendOtp(
  email: string,
  purpose: 'login' | 'signup' | 'password-reset' = 'login',
): Promise<SendOtpResponse> {
  const response = await fetch(`${API_PREFIX}/otp/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), purpose }),
  })
  return response.json()
}

/**
 * Verify an OTP code and receive an auth token.
 */
export async function verifyOtp(email: string, otp: string): Promise<VerifyOtpResponse> {
  const response = await fetch(`${API_PREFIX}/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp }),
  })
  return response.json()
}

/**
 * Set a new user password (requires valid auth session).
 */
export async function setUserPassword(
  password: string,
  confirmPassword: string,
): Promise<SetPasswordResponse> {
  const response = await fetch(`${API_PREFIX}/set-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, confirmPassword }),
  })
  return response.json()
}

/**
 * Create a new user account.
 */
export async function signup(
  name: string,
  email: string,
): Promise<SignupResponse> {
  const response = await fetch(`${API_PREFIX}/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name.trim(), email: email.trim() }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Signup failed')
  }
  return response.json()
}

/**
 * Redirect the browser to the Google OAuth login endpoint.
 */
export function initiateGoogleLogin(redirectTo = '/'): void {
  const params = new URLSearchParams()
  if (redirectTo !== '/') {
    params.set('redirect', redirectTo)
  }
  const qs = params.toString()
  window.location.href = `/api/users/oauth/google${qs ? `?${qs}` : ''}`
}