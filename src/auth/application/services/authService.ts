import type { PublicAuthConfig } from '../../../config'
import type { CredentialCapabilities } from '../../domain/credentials'
import type { ClientPasswordProof } from './passwordProof'
import type { SendOtpResponse, VerifyOtpResponse, SetPasswordResponse, SignupResponse } from '../../domain/types'

export class AuthRequestError extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code) }
}

/** Explicit per-tree HTTP adapter; no module-global options or account discovery. */
export function createAuthService(config: PublicAuthConfig) {
  const request = async (action: string, body: unknown) => {
    const response = await fetch(`${config.apiPrefix}${config.authEndpointPrefix}/${action}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await response.json()
    if (!response.ok) throw new AuthRequestError(data.code ?? 'AUTH_FAILED', response.status)
    return data
  }
  return {
    sendOtp: (email: string, context?: string): Promise<SendOtpResponse> => config.otpLogin ? request('otp/send', { email, purpose: 'login', ...(context ? { context } : {}) }) : Promise.reject(new Error('METHOD_DISABLED')),
    verifyOtp: (email: string, otp: string, context: string): Promise<VerifyOtpResponse> => config.otpLogin ? request('otp/verify', { email, otp, context, purpose: 'login' }) : Promise.reject(new Error('METHOD_DISABLED')),
    sendOwnership: (email: string, purpose: 'signup' | 'recovery' | 'reauth', context?: string): Promise<SendOtpResponse> => request('otp/send', { email, purpose, ...(context ? { context } : {}) }),
    verifyOwnership: (email: string, purpose: 'signup' | 'recovery' | 'reauth', otp: string, context: string): Promise<ClientPasswordProof> => request('otp/verify', { email, purpose, otp, context }),
    reauthenticate: (password: string): Promise<ClientPasswordProof> => request('reauthenticate', { password }),
    completePassword: (proof: ClientPasswordProof, password: string): Promise<SetPasswordResponse> => request(proof.purpose === 'signup' ? 'signup' : proof.purpose === 'recovery' ? 'reset-password' : 'set-password', { permit: proof.permit, password }),
    async principal(): Promise<{ email: string }> {
      const response = await fetch(`${config.apiPrefix}/${config.collection}/me`, { credentials: 'include', cache: 'no-store' })
      const data = await response.json()
      if (!response.ok || !data.user) throw new Error('UNAUTHENTICATED')
      return data.user
    },
    async login(credentials: { email: string; password: string }): Promise<void> {
      const response = await fetch(`${config.apiPrefix}${config.authEndpointPrefix}/login`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) })
      if (!response.ok) throw new Error('Login failed')
    },
    async credentials(): Promise<CredentialCapabilities> {
      const response = await fetch(`${config.apiPrefix}${config.authEndpointPrefix}/credentials`, { credentials: 'include', cache: 'no-store' })
      if (!response.ok) throw new Error('Unable to load credentials')
      return (await response.json() as { capabilities: CredentialCapabilities }).capabilities
    },
  }
}
const unavailable = async (): Promise<never> => { throw new Error('METHOD_DISABLED') }
/** @deprecated Public account discovery is permanently unavailable. */
export const checkEmail = unavailable
/** Disabled until dedicated hardened implementations are released. No transport effects. */
export async function sendOtp(_email: string, _purpose?: 'login' | 'signup' | 'password-reset'): Promise<SendOtpResponse> { return unavailable() }
export async function verifyOtp(_email: string, _otp: string): Promise<VerifyOtpResponse> { return unavailable() }
export async function setUserPassword(_password: string, _confirmPassword: string): Promise<SetPasswordResponse> { return unavailable() }
export async function signup(_name: string, _email: string): Promise<SignupResponse> { return unavailable() }
export function initiateGoogleLogin(_redirectTo = '/'): never { throw new Error('METHOD_DISABLED') }
