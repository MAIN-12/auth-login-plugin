// ============================================================
// RSC (React Server Components) exports for @main12/auth-login/rsc
// ============================================================

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
} from '../components/email/index.js'

export type {
  BaseTemplateOptions,
} from '../components/email/baseTemplate.js'

export type {
  EmailColors,
  SocialLink,
  SocialPlatform,
} from '../components/email/constants.js'

export type {
  SupportedLanguage,
  EmailTranslations,
} from '../components/email/translations.js'

export type {
  OtpEmailParams,
  OtpEmailResult,
  WelcomeEmailParams,
  WelcomeEmailResult,
  PasswordResetEmailParams,
  PasswordResetEmailResult,
  PasswordChangedEmailParams,
  PasswordChangedEmailResult,
} from '../components/email/index.js'

// Auth plugin config types
export type { AuthLoginPluginOptions } from '../index.js'