import { type SocialLink } from '../constants'
import { wrapInBaseTemplate, validatedEmailUrl, resolveEmailColors, type BaseTemplateOptions } from '../baseTemplate'
import { getEmailTranslations, type SupportedLanguage } from '../translations'

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

export function generateWelcomeEmail(params: WelcomeEmailParams): WelcomeEmailResult {
  const { userEmail, loginUrl = params.baseOptions?.domain ? `${params.baseOptions.domain.replace(/\/$/, '')}/login` : 'https://example.com/login', language = params.baseOptions?.language ?? 'en', socialLinks, baseOptions } = params
  const t = getEmailTranslations(language)
  const colors = resolveEmailColors(baseOptions?.colors)

  const content = `
    <tr>
      <td style="text-align:center;padding:24px 16px 8px;">
        <h1 style="margin:0;font-size:32px;font-weight:700;color:${colors.text};letter-spacing:-0.02em;">${t.welcome.title}</h1>
      </td>
    </tr>
    <tr>
      <td style="text-align:center;padding:16px 16px 32px;line-height:1.6;color:${colors.textSecondary};">
        <p style="margin:0;font-size:16px;">${t.welcome.introMessage}</p>
      </td>
    </tr>
    <tr>
      <td style="text-align:center;padding:16px;">
        <a href="${validatedEmailUrl(loginUrl)}" style="display:inline-block;background-color:${colors.primary};color:${colors.primaryText};font-weight:600;text-decoration:none;padding:14px 40px;border-radius:980px;font-size:16px;">${t.welcome.ctaButton}</a>
      </td>
    </tr>
    <tr>
      <td style="text-align:center;padding:24px 16px 8px;">
        <p style="margin:0;font-size:14px;color:${colors.textTertiary};line-height:1.6;">${t.welcome.helpMessage}</p>
      </td>
    </tr>`

  return {
    subject: t.welcome.subject,
    html: wrapInBaseTemplate(content, { ...baseOptions, preheader: t.welcome.preheader, language, socialLinks, userEmail }),
  }
}