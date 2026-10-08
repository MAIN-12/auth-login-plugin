// ============================================================
// RSC (React Server Components) exports for @main12/auth-login/rsc
// ============================================================

// Server component auth pages (requires explicit publicConfig)
export { default as AuthPages } from '../components/pages/AuthPages/server'
export type { AuthPagesProps } from '../components/pages/AuthPages/server'

// Server component auth card (requires explicit publicConfig)
export { AuthCard } from '../components/organisms/AuthCard/server'
export type {
  AuthCardProps,
  AuthCardWithSlugProps,
  AuthCardWithChildrenProps,
} from '../components/organisms/AuthCard/server'

// Layout component (can be used in server or client components)
export { AuthLayout } from '../components/templates/AuthLayout'
export type {
  AuthLayoutConfig,
  AuthLayoutProps,
  AuthTexture,
} from '../components/templates/AuthLayout'

// Form components (for custom compositions — re-exported from client)
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

// Email template system (server-only — uses Node APIs)
export {
  wrapInBaseTemplate,
  DEFAULT_COLORS,
  SOCIAL_ICONS,
  getBaseUrl,
  getSenderEmail,
  getEmailTranslations,
  generateOtpEmail,
  generateWelcomeEmail,
  generatePasswordResetEmail,
  generatePasswordChangedEmail,
} from '../auth/infrastructure/email'

export type { BaseTemplateOptions } from '../auth/infrastructure/email/baseTemplate'

export type {
  EmailColors,
  SocialLink,
  SocialPlatform,
} from '../auth/infrastructure/email/constants'

export type { SupportedLanguage, EmailTranslations } from '../i18n/email'

export type {
  OtpEmailParams,
  OtpEmailResult,
  WelcomeEmailParams,
  WelcomeEmailResult,
  PasswordResetEmailParams,
  PasswordResetEmailResult,
  PasswordChangedEmailParams,
  PasswordChangedEmailResult,
} from '../auth/infrastructure/email'

// Auth plugin config types
export type { AuthLoginPluginOptions } from '../config'

export { AuthProvider } from '../auth/interface/react/providers/AuthProviderServer'
export type { AuthProviderProps, AuthUser } from '../auth/interface/react/providers/AuthProvider'

export type {
  AuthPresentationProps,
  AuthLocalizationProps,
  ResolvedAuthPresentation,
  PoweredByConfig,
} from '../configuration/authAppearance/types'
