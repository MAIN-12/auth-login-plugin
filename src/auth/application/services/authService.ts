import type { PublicAuthConfig } from '../../../config'
import type { CredentialCapabilities } from '../../domain/credentials'
import type { SendOtpResponse, VerifyOtpResponse, SetPasswordResponse, SignupResponse } from '../../domain/types'

/** Explicit per-tree HTTP adapter; no module-global options or account discovery. */
export function createAuthService(config: PublicAuthConfig) {
  return {
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
