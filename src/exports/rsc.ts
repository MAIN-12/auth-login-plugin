// ============================================================
// RSC (React Server Components) exports for @main12/auth-login/rsc
// ============================================================

// Server component auth pages (reads plugin config automatically)
export { default as AuthPages } from '../components/AuthPagesServer'
export type { AuthPagesProps } from '../components/AuthPagesServer'

// Server component auth card (reads plugin config automatically)
export { AuthCard } from '../components/AuthCardServer'
export type { AuthCardProps, AuthCardWithSlugProps, AuthCardWithChildrenProps } from '../components/AuthCardServer'

// Layout component (can be used in server or client components)
export { AuthLayout } from '../components/AuthLayout'
export type { AuthLayoutConfig, AuthLayoutProps } from '../components/AuthLayout'

// Form components (for custom compositions — re-exported from client)
export { LoginForm, SignupForm, ForgotPasswordForm, VerifyOtpForm, SetPasswordForm } from '../components/forms/index'
export type { LoginFormProps, SignupFormProps, ForgotPasswordFormProps, VerifyOtpFormProps, SetPasswordFormProps } from '../components/forms/index'

// Form registry (for advanced usage / extending)
export { AUTH_FORMS, getFormBySlug, type AuthFormSlug } from '../components/forms/index'

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
} from '../components/email/index'

export type {
  BaseTemplateOptions,
} from '../components/email/baseTemplate'

export type {
  EmailColors,
  SocialLink,
  SocialPlatform,
} from '../components/email/constants'

export type {
  SupportedLanguage,
  EmailTranslations,
} from '../components/email/translations'

export type {
  OtpEmailParams,
  OtpEmailResult,
  WelcomeEmailParams,
  WelcomeEmailResult,
  PasswordResetEmailParams,
  PasswordResetEmailResult,
  PasswordChangedEmailParams,
  PasswordChangedEmailResult,
} from '../components/email/index'

// Auth plugin config types
export type { AuthLoginPluginOptions } from '../index'