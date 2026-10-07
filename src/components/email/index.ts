export { wrapInBaseTemplate, type BaseTemplateOptions } from './baseTemplate'
export {
  DEFAULT_COLORS,
  SOCIAL_ICONS,
  getBaseUrl,
  getSenderEmail,
  type EmailColors,
  type SocialLink,
  type SocialPlatform,
} from './constants'
export {
  getEmailTranslations,
  type SupportedLanguage,
  type EmailTranslations,
} from './translations'
export { generateOtpEmail, type OtpEmailParams, type OtpEmailResult } from './templates/otp'
export {
  generateWelcomeEmail,
  type WelcomeEmailParams,
  type WelcomeEmailResult,
} from './templates/welcome'
export {
  generatePasswordResetEmail,
  type PasswordResetEmailParams,
  type PasswordResetEmailResult,
} from './templates/passwordReset'
export {
  generatePasswordChangedEmail,
  type PasswordChangedEmailParams,
  type PasswordChangedEmailResult,
} from './templates/passwordChanged'
