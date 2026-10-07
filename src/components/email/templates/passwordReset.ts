import { type SocialLink } from '../constants'
import { wrapInBaseTemplate, escapeEmailText, resolveEmailColors, type BaseTemplateOptions } from '../baseTemplate'
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
  const { userName, otp, language = params.baseOptions?.language ?? 'en', socialLinks, baseOptions } = params
  const t = getEmailTranslations(language)
  const colors = resolveEmailColors(baseOptions?.colors)

  const content = `
    <tr>
      <td style="text-align:center;padding-bottom:32px;">
        <h1 style="margin:0 0 12px;font-size:28px;font-weight:600;color:${colors.text};">${t.passwordReset.title}</h1>
        <p style="margin:0;font-size:17px;color:${colors.textSecondary};line-height:1.5;">${t.greeting} ${escapeEmailText(userName)}, ${t.passwordReset.intro}</p>
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
        <p style="margin:0 0 8px;font-size:14px;color:${colors.textTertiary};">${t.passwordReset.expiresIn} <span style="color:${colors.textSecondary};">5 ${language === 'es' ? 'minutos' : 'minutes'}</span></p>
        <p style="margin:0;font-size:13px;color:${colors.textTertiary};">${t.passwordReset.warningMessage}</p>
      </td>
    </tr>`

  return {
    subject: t.passwordReset.subject,
    html: wrapInBaseTemplate(content, { ...baseOptions, preheader: t.passwordReset.preheader, language, socialLinks }),
  }
}