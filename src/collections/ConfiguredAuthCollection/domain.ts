/** Portable configured auth collection credential policy and selected evidence. */
export type { OwnershipAccount, Principal } from './domain/account'
export { credentialCapabilities } from './domain/credentials'
export type { CredentialCapabilities } from './domain/credentials'
export { parsePasswordCredentials } from './domain/passwordLoginRules'
export type { PasswordCredentials } from './domain/passwordLoginRules'
export {
  MIN_PASSWORD_LENGTH,
  evaluatePasswordStrength,
  isPasswordValid,
} from './domain/passwordRules'
export type { PasswordStrengthResult } from './domain/types'
