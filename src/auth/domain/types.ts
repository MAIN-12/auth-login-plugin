export interface PasswordStrengthResult {
  score: number // 0-5
  hasMinLength: boolean
  hasUppercase: boolean
  hasLowercase: boolean
  hasNumber: boolean
  hasSpecial: boolean
  isValid: boolean
}
