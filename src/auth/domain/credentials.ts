/** Non-secret evidence, never inferred from an omitted public password field. */
export interface CredentialCapabilities {
  password: 'available' | 'unavailable' | 'unknown'
  emailVerification: 'verified' | 'unverified' | 'unknown'
}
export function credentialCapabilities(evidence: {
  passwordAuthenticated?: boolean
  verified?: boolean
}): CredentialCapabilities {
  return {
    password: evidence.passwordAuthenticated === true ? 'available' : 'unknown',
    emailVerification:
      evidence.verified === true
        ? 'verified'
        : evidence.verified === false
          ? 'unverified'
          : 'unknown',
  }
}
