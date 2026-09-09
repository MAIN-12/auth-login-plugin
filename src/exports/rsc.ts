// ============================================================
// RSC (React Server Components) exports for @main12/auth-login/rsc
// ============================================================

// Server component auth pages (reads plugin config automatically)
export { default as AuthPages } from '../components/AuthPagesServer'
export type { AuthPagesProps } from '../components/AuthPagesServer'

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