import { type SocialLink } from '../constants'
import {
  wrapInBaseTemplate,
  escapeEmailText,
  resolveEmailColors,
  type BaseTemplateOptions,
} from '../baseTemplate'
import { getEmailTranslations, type SupportedLanguage } from '../translations'

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
  const {
    userName,
    otp,
    purpose = 'login',
    language = params.baseOptions?.language ?? 'en',
    socialLinks,
    baseOptions,
  } = params
  const t = getEmailTranslations(language)
  const colors = resolveEmailColors(baseOptions?.colors)
  const purposeText = purpose === 'password-reset' ? t.otp.purposePasswordReset : t.otp.purposeLogin
  const subject = purpose === 'password-reset' ? t.otp.subjectPasswordReset : t.otp.subjectLogin

  const content = `
    <tr>
      <td style="text-align:center;padding-bottom:32px;">
        <h1 style="margin:0 0 12px;font-size:28px;font-weight:600;color:${colors.text};letter-spacing:-0.02em;">${t.greeting} ${escapeEmailText(userName)}</h1>
        <p style="margin:0;font-size:17px;color:${colors.textSecondary};line-height:1.5;">${purposeText}</p>
      </td>
    </tr>
    <tr>
      <td style="text-align:center;padding-bottom:32px;">
        <div style="display:inline-block;background-color:${colors.backgroundSecondary};border-radius:12px;padding:20px 32px;">
          <span style="font-size:32px;font-weight:600;letter-spacing:6px;color:${colors.text};font-family:'SF Mono',SFMono-Regular,ui-monospace,Menlo,monospace;">${escapeEmailText(otp)}</span>
        </div>
      </td>
    </tr>
    <tr>
      <td style="text-align:center;">
        <p style="margin:0 0 8px;font-size:14px;color:${colors.textTertiary};">${t.otp.expiresIn} <span style="color:${colors.textSecondary};">5 ${language === 'es' ? 'minutos' : 'minutes'}</span></p>
        <p style="margin:0;font-size:13px;color:${colors.textTertiary};">${t.otp.ignoreMessage}</p>
      </td>
    </tr>`

  return {
    subject,
    html: wrapInBaseTemplate(content, {
      ...baseOptions,
      preheader: t.otp.preheader,
      language,
      socialLinks,
    }),
  }
}
