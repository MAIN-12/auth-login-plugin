import compromised from './password-blocklist-eligible.json' with { type: 'json' }
import type { PasswordStrengthResult } from './types'

// Generated from the licensed corpus: shorter entries already fail the length rule.
const blocked = new Set(compromised)
export const MIN_PASSWORD_LENGTH = 15

/**
 * Compatibility display flags/score are descriptive only, not composition requirements.
 * Validity uses Unicode length, the input bound and case-insensitive corpus membership.
 * Lowercasing is only for membership; the owner-chosen credential remains unchanged.
 */
export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const hasMinLength = Array.from(password).length >= MIN_PASSWORD_LENGTH
  const hasUppercase = /[A-Z]/.test(password)
  const hasLowercase = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSpecial = /[^A-Za-z0-9]/.test(password)

  const criteria = [hasMinLength, hasUppercase, hasLowercase, hasNumber, hasSpecial]
  const met = criteria.filter(Boolean).length

  return {
    score: met,
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecial,
    isValid: hasMinLength && password.length <= 1024 && !blocked.has(password.toLowerCase()),
  }
}

/**
 * Quick check: does password meet minimum requirements?
 */
export function isPasswordValid(password: string): boolean {
  return evaluatePasswordStrength(password).isValid
}
