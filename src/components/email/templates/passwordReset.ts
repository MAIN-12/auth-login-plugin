import { DEFAULT_COLORS, type SocialLink } from '../constants'
import { wrapInBaseTemplate, type BaseTemplateOptions } from '../baseTemplate'
import { getEmailTranslations, type SupportedLanguage } from '../translations'

export interface PasswordResetEmailParams {
  userName: string
  otp: string
  language?: SupportedLanguage
  socialLinks?: SocialLink[]
  baseOptions?: BaseTemplateOptions
}

export interface PasswordResetEmailResult { subject: string; html: string }

export function generatePasswordResetEmail(params: PasswordResetEmailParams): PasswordResetEmailResult {
  const { userName, otp, language = 'en', socialLinks, baseOptions } = params
  const t = getEmailTranslations(language)

  const content = `
    <tr>
      <td style="text-align:center;padding-bottom:32px;">
        <h1 style="margin:0 0 12px;font-size:28px;font-weight:600;color:${DEFAULT_COLORS.text};">${t.passwordReset.title}</h1>
        <p style="margin:0;font-size:17px;color:${DEFAULT_COLORS.textSecondary};line-height:1.5;">${t.greeting} ${userName}, ${t.passwordReset.intro}</p>
      </td>
    </tr>
    <tr>
      <td style="text-align:center;padding-bottom:32px;">
        <div style="display:inline-block;background-color:${DEFAULT_COLORS.backgroundSecondary};border-radius:12px;padding:20px 32px;">
          <span style="font-size:32px;font-weight:600;letter-spacing:6px;color:${DEFAULT_COLORS.text};font-family:'SF Mono',SFMono-Regular,ui-monospace,Menlo,monospace;">${otp}</span>
        </div>
      </td>
    </tr>
    <tr>
      <td style="text-align:center;">
        <p style="margin:0 0 8px;font-size:14px;color:${DEFAULT_COLORS.textTertiary};">${t.passwordReset.expiresIn} <span style="color:${DEFAULT_COLORS.textSecondary};">10 ${language === 'es' ? 'minutos' : 'minutes'}</span></p>
        <p style="margin:0;font-size:13px;color:${DEFAULT_COLORS.textTertiary};">${t.passwordReset.warningMessage}</p>
      </td>
    </tr>`

  return {
    subject: t.passwordReset.subject,
    html: wrapInBaseTemplate(content, { ...baseOptions, preheader: `${t.passwordReset.preheader}: ${otp}`, language, socialLinks }),
  }
}