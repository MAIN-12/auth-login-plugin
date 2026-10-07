import { type SocialLink } from '../constants'
import { wrapInBaseTemplate, escapeEmailText, validatedEmailUrl, resolveEmailColors, type BaseTemplateOptions } from '../baseTemplate'
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
  const { userName, loginUrl = params.baseOptions?.domain ? `${params.baseOptions.domain.replace(/\/$/, '')}/login` : 'https://example.com/login', language = params.baseOptions?.language ?? 'en', socialLinks, baseOptions } = params
  const t = getEmailTranslations(language)
  const colors = resolveEmailColors(baseOptions?.colors)

  const content = `
    <tr>
      <td style="text-align:center;padding-bottom:32px;">
        <h1 style="margin:0 0 12px;font-size:28px;font-weight:600;color:${colors.text};">${t.passwordChanged.title}</h1>
        <p style="margin:0;font-size:17px;color:${colors.textSecondary};line-height:1.5;">${t.greeting} ${escapeEmailText(userName)}, ${t.passwordChanged.message}</p>
      </td>
    </tr>
    <tr>
      <td style="text-align:center;padding:16px;">
        <a href="${validatedEmailUrl(loginUrl)}" style="display:inline-block;background-color:${colors.primary};color:${colors.primaryText};font-weight:600;text-decoration:none;padding:14px 40px;border-radius:980px;font-size:16px;">${t.passwordChanged.ctaButton}</a>
      </td>
    </tr>
    <tr>
      <td style="text-align:center;padding:24px 16px 8px;">
        <p style="margin:0;font-size:13px;color:${colors.textTertiary};">${t.passwordChanged.warningMessage}</p>
      </td>
    </tr>`

  return {
    subject: t.passwordChanged.subject,
    html: wrapInBaseTemplate(content, { ...baseOptions, preheader: t.passwordChanged.preheader, language, socialLinks }),
  }
}