'use client'

// ============================================================
// Client-side exports for @main12/auth-login/client
// ============================================================

// Auth hooks
export { useLoginFlow } from '../auth/application/hooks/useLoginFlow.js'
export { useVerifyOtpFlow } from '../auth/application/hooks/useVerifyOtpFlow.js'
export { useForgotPasswordFlow } from '../auth/application/hooks/useForgotPasswordFlow.js'
export { useSetPasswordFlow } from '../auth/application/hooks/useSetPasswordFlow.js'

// Auth service functions (client-side fetch wrappers)
export {
  checkEmail,
  sendOtp,
  verifyOtp,
  setUserPassword,
  signup,
  initiateGoogleLogin,
} from '../auth/application/services/authService.js'

// Domain utilities
export { evaluatePasswordStrength, isPasswordValid, MIN_PASSWORD_LENGTH } from '../auth/domain/passwordRules.js'

// Page components
export { default as LoginPage } from '../components/pages/LoginPage.js'
export { default as SignupPage } from '../components/pages/SignupPage.js'
export { default as ForgotPasswordPage } from '../components/pages/ForgotPasswordPage.js'
export { default as VerifyOtpPage } from '../components/pages/VerifyOtpPage.js'
export { default as SetPasswordPage } from '../components/pages/SetPasswordPage.js'

// Layout & shared components
export { AuthLayout } from '../components/AuthLayout.js'
export { PoweredBy } from '../components/PoweredBy.js'

// Types
export type {
  LoginStep,
  OTPPurpose,
  CheckEmailResponse,
  SendOtpResponse,
  VerifyOtpResponse,
  SetPasswordResponse,
  SignupResponse,
  PasswordStrengthResult,
} from '../auth/domain/types.js'

export type { UseLoginFlowOptions } from '../auth/application/hooks/useLoginFlow.js'
export type { UseVerifyOtpFlowOptions } from '../auth/application/hooks/useVerifyOtpFlow.js'
export type { UseSetPasswordFlowOptions } from '../auth/application/hooks/useSetPasswordFlow.js'

export type { LoginPageProps } from '../components/pages/LoginPage.js'
export type { SignupPageProps } from '../components/pages/SignupPage.js'
export type { ForgotPasswordPageProps } from '../components/pages/ForgotPasswordPage.js'
export type { VerifyOtpPageProps } from '../components/pages/VerifyOtpPage.js'
export type { SetPasswordPageProps } from '../components/pages/SetPasswordPage.js'
export type { AuthLayoutConfig, AuthLayoutProps } from '../components/AuthLayout.js'
export type { PoweredByProps } from '../components/PoweredBy.js'