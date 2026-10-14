'use client'

// ============================================================
// Client-side exports for @main12/auth-login/client
// ============================================================

// Plugin client config initializer
export {
  AuthConfigProvider,
  useAuthConfig,
} from '../authentication/interface/react/providers/AuthConfigProvider/index'
export type { PublicAuthConfig } from '../shared/contracts/publicConfig'
export { AuthClientInit } from '../authentication/interface/react/providers/AuthClientInit/index'

// Auth hooks
export { useLoginFlow } from '../authentication/interface/react/hooks/useLoginFlow'
export { useVerifyOtpFlow } from '../authentication/interface/react/hooks/useVerifyOtpFlow'
export { useForgotPasswordFlow } from '../authentication/interface/react/hooks/useForgotPasswordFlow'
export { useSetPasswordFlow } from '../authentication/interface/react/hooks/useSetPasswordFlow'

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
} from '../authentication/interface/client/authService'

// Domain utilities
export {
  evaluatePasswordStrength,
  isPasswordValid,
  MIN_PASSWORD_LENGTH,
} from '../collections/ConfiguredAuthCollection/domain'

// UI translations / locale utilities
export { getUiTranslations, uiTranslations } from '../i18n/ui'
export type { UiTranslations, DeepPartial } from '../i18n/ui'
export { detectClientLocale } from '../i18n/locale'

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
  AuthCardTheme,
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
} from '../components/organisms/AuthCard/forms'
export type {
  LoginFormProps,
  SignupFormProps,
  ForgotPasswordFormProps,
  VerifyOtpFormProps,
  SetPasswordFormProps,
} from '../components/organisms/AuthCard/forms'

// Form registry (for advanced usage / extending)
export {
  AUTH_FORMS,
  getFormBySlug,
  type AuthFormSlug,
} from '../components/organisms/AuthCard/forms'

// Types
export type {
  LoginStep,
  OTPPurpose,
  CheckEmailResponse,
  SendOtpResponse,
  VerifyOtpResponse,
  SetPasswordResponse,
  SignupResponse,
} from '../authentication/contracts/clientModels'

export type { UseLoginFlowOptions } from '../authentication/interface/react/hooks/useLoginFlow'
export type { UseVerifyOtpFlowOptions } from '../authentication/interface/react/hooks/useVerifyOtpFlow'
export type { UseSetPasswordFlowOptions } from '../authentication/interface/react/hooks/useSetPasswordFlow'

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

export {
  AuthProvider,
  useAuth,
} from '../authentication/interface/react/providers/AuthProvider/index'
export type {
  AuthProviderProps,
  AuthContextValue,
  AuthUser,
  AuthStatus,
  OpenLoginOptions,
} from '../authentication/interface/react/providers/AuthProvider/index'

export type {
  AuthPresentationProps,
  AuthLocalizationProps,
  ResolvedAuthPresentation,
  PoweredByConfig,
} from '../configuration/authAppearance/types'
export { useAuthPresentation, useAuthTranslations } from '../contexts/AuthAppearanceContext'

export type { CredentialCapabilities } from '../collections/ConfiguredAuthCollection/domain'

export type { AuthErrorCode, AuthErrorReason, AuthErrorResponse } from '../shared/contracts/errors'

export type { PasswordStrengthResult } from '../collections/ConfiguredAuthCollection/domain'
