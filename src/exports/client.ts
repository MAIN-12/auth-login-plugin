'use client'

// ============================================================
// Client-side exports for @main12/auth-login/client
// ============================================================

// Plugin client config initializer
export { AuthConfigProvider, useAuthConfig } from '../components/AuthConfigContext'
export type { PublicAuthConfig } from '../auth/contracts/publicConfig'
export { AuthClientInit } from '../components/AuthClientInit'

// Auth hooks
export { useLoginFlow } from '../auth/interface/react/hooks/useLoginFlow'
export { useVerifyOtpFlow } from '../auth/interface/react/hooks/useVerifyOtpFlow'
export { useForgotPasswordFlow } from '../auth/interface/react/hooks/useForgotPasswordFlow'
export { useSetPasswordFlow } from '../auth/interface/react/hooks/useSetPasswordFlow'

// Auth service functions (client-side fetch wrappers)
export {
  createAuthService,
  AuthRequestError,
  checkEmail,
  sendOtp,
  verifyOtp,
  setUserPassword,
  signup,
  initiateGoogleLogin,
} from '../auth/interface/client/authService'

// Domain utilities
export {
  evaluatePasswordStrength,
  isPasswordValid,
  MIN_PASSWORD_LENGTH,
} from '../auth/domain/passwordRules'

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
export { default as AuthPages } from '../components/pages/AuthPages'
export type { AuthPagesProps } from '../components/pages/AuthPages'

// Layout & shared components
export { AuthLayout } from '../components/templates/AuthLayout'
export { AuthCard } from '../components/organisms/AuthCard'
export type {
  AuthCardProps,
  AuthCardConfig,
  AuthCardWithSlugProps,
  AuthCardWithChildrenProps,
} from '../components/organisms/AuthCard'
export { PoweredBy } from '../components/molecules/PoweredBy'

// Form components (for custom compositions)
export {
  LoginForm,
  SignupForm,
  ForgotPasswordForm,
  VerifyOtpForm,
  SetPasswordForm,
} from '../components/organisms/forms'
export type {
  LoginFormProps,
  SignupFormProps,
  ForgotPasswordFormProps,
  VerifyOtpFormProps,
  SetPasswordFormProps,
} from '../components/organisms/forms'

// Form registry (for advanced usage / extending)
export { AUTH_FORMS, getFormBySlug, type AuthFormSlug } from '../components/organisms/forms'

// Types
export type {
  LoginStep,
  OTPPurpose,
  CheckEmailResponse,
  SendOtpResponse,
  VerifyOtpResponse,
  SetPasswordResponse,
  SignupResponse,
} from '../auth/contracts/clientModels'

export type { UseLoginFlowOptions } from '../auth/interface/react/hooks/useLoginFlow'
export type { UseVerifyOtpFlowOptions } from '../auth/interface/react/hooks/useVerifyOtpFlow'
export type { UseSetPasswordFlowOptions } from '../auth/interface/react/hooks/useSetPasswordFlow'

export type { LoginPageProps } from '../components/pages/LoginPage'
export type { SignupPageProps } from '../components/pages/SignupPage'
export type { ForgotPasswordPageProps } from '../components/pages/ForgotPasswordPage'
export type { VerifyOtpPageProps } from '../components/pages/VerifyOtpPage'
export type { SetPasswordPageProps } from '../components/pages/SetPasswordPage'
export type {
  AuthLayoutConfig,
  AuthLayoutProps,
  AuthTexture,
} from '../components/templates/AuthLayout'
export type { PoweredByProps } from '../components/molecules/PoweredBy'

export { AuthProvider, useAuth } from '../components/AuthProvider'
export type {
  AuthProviderProps,
  AuthContextValue,
  AuthUser,
  AuthStatus,
  OpenLoginOptions,
} from '../components/AuthProvider'

export type {
  AuthPresentationProps,
  AuthLocalizationProps,
  ResolvedAuthPresentation,
  PoweredByConfig,
} from '../components/auth-presentation/types'
export {
  useAuthPresentation,
  useAuthTranslations,
} from '../components/auth-presentation/AuthPresentationContext'

export type { CredentialCapabilities } from '../auth/domain/credentials'

export type { AuthErrorCode, AuthErrorResponse } from '../auth/contracts/errors'

export type { PasswordStrengthResult } from '../auth/domain/types'
