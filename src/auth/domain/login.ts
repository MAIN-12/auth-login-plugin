/** Transitional legacy import path only; retire in auth-clean 06. */
export { AuthFailure } from '../contracts/errors'
export type { AuthErrorCode, AuthErrorResponse } from '../contracts/errors'
export type { PasswordCredentials } from './passwordLoginRules'
export { parsePasswordCredentials, createPasswordLogin } from '../contracts/loginCompatibility'
