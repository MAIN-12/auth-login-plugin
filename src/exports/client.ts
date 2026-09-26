'use client'

// ============================================================
// Client-side exports for @main12/auth-login/client
// ============================================================

// Plugin client config initializer
export { initClientConfig } from '../config'
export { AuthClientInit } from '../components/AuthClientInit'
export type { AuthClientInitProps } from '../components/AuthClientInit'

// Auth hooks
export { useLoginFlow } from '../auth/application/hooks/useLoginFlow'
export { useVerifyOtpFlow } from '../auth/application/hooks/useVerifyOtpFlow'
export { useForgotPasswordFlow } from '../auth/application/hooks/useForgotPasswordFlow'
export { useSetPasswordFlow } from '../auth/application/hooks/useSetPasswordFlow'

// Auth service functions (client-side fetch wrappers)
export {
  checkEmail,
  sendOtp,
  verifyOtp,
  setUserPassword,
  signup,
  initiateGoogleLogin,
} from '../auth/application/services/authService'

// Domain utilities
export { evaluatePasswordStrength, isPasswordValid, MIN_PASSWORD_LENGTH } from '../auth/domain/passwordRules'

// UI translations / locale utilities
export { getUiTranslations, uiTranslations } from '../components/ui/translations'
export type { UiTranslations, DeepPartial } from '../components/ui/translations'
export { detectClientLocale } from '../components/ui/locale'

// Page components
export { default as LoginPage } from '../components/pages/LoginPage'
export { default as SignupPage } from '../components/pages/SignupPage'
export { default as ForgotPasswordPage } from '../components/pages/ForgotPasswordPage'
export { default as VerifyOtpPage } from '../components/pages/VerifyOtpPage'
export { default as SetPasswordPage } from '../components/pages/SetPasswordPage'

// Catch-all auth pages (single-file setup)
export { default as AuthPages } from '../components/AuthPages'
export type { AuthPagesProps } from '../components/AuthPages'

// Layout & shared components
export { AuthLayout } from '../components/AuthLayout'
export { AuthCard } from '../components/AuthCard'
export type { AuthCardProps, AuthCardConfig, AuthCardWithSlugProps, AuthCardWithChildrenProps } from '../components/AuthCard'
export { PoweredBy } from '../components/PoweredBy'

// Form components (for custom compositions)
export { LoginForm, SignupForm, ForgotPasswordForm, VerifyOtpForm, SetPasswordForm } from '../components/forms/index'
export type { LoginFormProps, SignupFormProps, ForgotPasswordFormProps, VerifyOtpFormProps, SetPasswordFormProps } from '../components/forms/index'

// Form registry (for advanced usage / extending)
export { AUTH_FORMS, getFormBySlug, type AuthFormSlug } from '../components/forms/index'

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
} from '../auth/domain/types'

export type { UseLoginFlowOptions } from '../auth/application/hooks/useLoginFlow'
export type { UseVerifyOtpFlowOptions } from '../auth/application/hooks/useVerifyOtpFlow'
export type { UseSetPasswordFlowOptions } from '../auth/application/hooks/useSetPasswordFlow'

export type { LoginPageProps } from '../components/pages/LoginPage'
export type { SignupPageProps } from '../components/pages/SignupPage'
export type { ForgotPasswordPageProps } from '../components/pages/ForgotPasswordPage'
export type { VerifyOtpPageProps } from '../components/pages/VerifyOtpPage'
export type { SetPasswordPageProps } from '../components/pages/SetPasswordPage'
export type { AuthLayoutConfig, AuthLayoutProps } from '../components/AuthLayout'
export type { PoweredByProps } from '../components/PoweredBy'