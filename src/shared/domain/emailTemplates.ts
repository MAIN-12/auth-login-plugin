import type { EmailColors } from './emailPresentation'

type SupportedLanguage = 'en' | 'es'

export type SocialPlatform =
  'facebook' | 'twitter' | 'instagram' | 'linkedin' | 'youtube' | 'tiktok' | 'github' | 'discord'

export interface SocialLink {
  platform: SocialPlatform
  url: string
}

export interface BaseTemplateOptions {
  logoUrl?: string
  projectName?: string
  domain?: string
  contactEmail?: string
  contactUrl?: string
  colors?: Partial<EmailColors>
  preheader?: string
  language?: SupportedLanguage
  socialLinks?: SocialLink[]
  userEmail?: string
}

export interface OtpEmailParams {
  userName: string
  otp: string
  purpose?: 'login' | 'password-reset' | 'signup' | 'verify-email' | 'reauth'
  expiresInSeconds?: number
  language?: SupportedLanguage
  socialLinks?: SocialLink[]
  baseOptions?: BaseTemplateOptions
}

export interface OtpEmailResult {
  subject: string
  html: string
}

export interface WelcomeEmailParams {
  userName: string
  userEmail?: string
  loginUrl?: string
  language?: SupportedLanguage
  socialLinks?: SocialLink[]
  baseOptions?: BaseTemplateOptions
}

export interface WelcomeEmailResult {
  subject: string
  html: string
}

export interface PasswordResetEmailParams {
  userName: string
  otp: string
  language?: SupportedLanguage
  socialLinks?: SocialLink[]
  baseOptions?: BaseTemplateOptions
}

export interface PasswordResetEmailResult {
  subject: string
  html: string
}

export interface PasswordChangedEmailParams {
  userName: string
  loginUrl?: string
  language?: SupportedLanguage
  socialLinks?: SocialLink[]
  baseOptions?: BaseTemplateOptions
}

export interface PasswordChangedEmailResult {
  subject: string
  html: string
}

export interface AuthEmailParams {
  otp: OtpEmailParams
  welcome: WelcomeEmailParams
  passwordReset: PasswordResetEmailParams
  passwordChanged: PasswordChangedEmailParams
}

export interface AuthEmailResult {
  subject: string
  html: string
}

/** Server-side callbacks. Omitted templates retain their built-in implementation. */
export type AuthEmailOverrides = {
  [K in keyof AuthEmailParams]?: (
    params: AuthEmailParams[K],
  ) => AuthEmailResult | Promise<AuthEmailResult>
}
