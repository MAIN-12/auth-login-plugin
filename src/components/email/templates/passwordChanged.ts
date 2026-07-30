import { DEFAULT_COLORS, getBaseUrl, type SocialLink } from '../constants'
import { wrapInBaseTemplate, type BaseTemplateOptions } from '../baseTemplate'
import { getEmailTranslations, type SupportedLanguage } from '../translations'

export interface PasswordChangedEmailParams {
  userName: string
  loginUrl?: string
  language?: SupportedLanguage
  socialLinks?: SocialLink[]
  baseOptions?: BaseTemplateOptions
}

export interface PasswordChangedEmailResult { subject: string; html: string }

export function generatePasswordChangedEmail(params: PasswordChangedEmailParams): PasswordChangedEmailResult {
  const { userName, loginUrl = `${getBaseUrl()}/login`, language = 'en', socialLinks, baseOptions } = params
  const t = getEmailTranslations(language)

  const content = `
    <tr>
      <td style="text-align:center;padding-bottom:32px;">
        <h1 style="margin:0 0 12px;font-size:28px;font-weight:600;color:${DEFAULT_COLORS.text};">${t.passwordChanged.title}</h1>
        <p style="margin:0;font-size:17px;color:${DEFAULT_COLORS.textSecondary};line-height:1.5;">${t.greeting} ${userName}, ${t.passwordChanged.message}</p>
      </td>
    </tr>
    <tr>
      <td style="text-align:center;padding:16px;">
        <a href="${loginUrl}" style="display:inline-block;background-color:${DEFAULT_COLORS.primary};color:${DEFAULT_COLORS.primaryText};font-weight:600;text-decoration:none;padding:14px 40px;border-radius:980px;font-size:16px;">${t.passwordChanged.ctaButton}</a>
      </td>
    </tr>
    <tr>
      <td style="text-align:center;padding:24px 16px 8px;">
        <p style="margin:0;font-size:13px;color:${DEFAULT_COLORS.textTertiary};">${t.passwordChanged.warningMessage}</p>
      </td>
    </tr>`

  return {
    subject: t.passwordChanged.subject,
    html: wrapInBaseTemplate(content, { ...baseOptions, preheader: t.passwordChanged.preheader, language, socialLinks }),
  }
}