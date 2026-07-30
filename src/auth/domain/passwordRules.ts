import type { PasswordStrengthResult } from './types'

export const MIN_PASSWORD_LENGTH = 8
export const MIN_CRITERIA_COUNT = 3

/**
 * Evaluate password strength against standard criteria.
 * Returns a score 0-5 and individual flag checks.
 */
export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const hasMinLength = password.length >= MIN_PASSWORD_LENGTH
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
    isValid: met >= MIN_CRITERIA_COUNT,
  }
}

/**
 * Quick check: does password meet minimum requirements?
 */
export function isPasswordValid(password: string): boolean {
  return evaluatePasswordStrength(password).isValid
}