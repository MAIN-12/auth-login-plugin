import { DEFAULT_COLORS, type SocialLink } from '../constants.js'
import { wrapInBaseTemplate, type BaseTemplateOptions } from '../baseTemplate.js'
import { getEmailTranslations, type SupportedLanguage } from '../translations.js'

export interface OtpEmailParams {
  userName: string
  otp: string
  purpose?: 'login' | 'password-reset'
  language?: SupportedLanguage
  socialLinks?: SocialLink[]
  baseOptions?: BaseTemplateOptions
}

export interface OtpEmailResult {
  subject: string
  html: string
}

export function generateOtpEmail(params: OtpEmailParams): OtpEmailResult {
  const { userName, otp, purpose = 'login', language = 'en', socialLinks, baseOptions } = params
  const t = getEmailTranslations(language)
  const purposeText = purpose === 'password-reset' ? t.otp.purposePasswordReset : t.otp.purposeLogin
  const subject = purpose === 'password-reset'
    ? `${t.otp.subjectPasswordReset}: ${otp}`
    : `${t.otp.subjectLogin}: ${otp}`

  const content = `
    <tr>
      <td style="text-align:center;padding-bottom:32px;">
        <h1 style="margin:0 0 12px;font-size:28px;font-weight:600;color:${DEFAULT_COLORS.text};letter-spacing:-0.02em;">${t.greeting} ${userName}</h1>
        <p style="margin:0;font-size:17px;color:${DEFAULT_COLORS.textSecondary};line-height:1.5;">${purposeText}</p>
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
        <p style="margin:0 0 8px;font-size:14px;color:${DEFAULT_COLORS.textTertiary};">${t.otp.expiresIn} <span style="color:${DEFAULT_COLORS.textSecondary};">10 ${language === 'es' ? 'minutos' : 'minutes'}</span></p>
        <p style="margin:0;font-size:13px;color:${DEFAULT_COLORS.textTertiary};">${t.otp.ignoreMessage}</p>
      </td>
    </tr>`

  return {
    subject,
    html: wrapInBaseTemplate(content, { ...baseOptions, preheader: `${t.otp.preheader}: ${otp}`, language, socialLinks }),
  }
}