import { withOtpSubject } from '../../../domain/emailPresentation'
import { wrapInBaseTemplate, escapeEmailText, resolveEmailColors } from '../baseTemplate'
import { otpContent } from '../otpContent'
import { getEmailTranslations } from '../../../../i18n/email'

import type { OtpEmailParams, OtpEmailResult } from '../../../domain/emailTemplates'
export type { OtpEmailParams, OtpEmailResult } from '../../../domain/emailTemplates'

export function generateOtpEmail(params: OtpEmailParams): OtpEmailResult {
  const {
    otp,
    purpose = 'login',
    language = params.baseOptions?.language ?? 'en',
    socialLinks,
    baseOptions,
  } = params
  const t = getEmailTranslations(language)
  const colors = resolveEmailColors(baseOptions?.colors)
  const copy = otpContent({ ...params, purpose, language })

  const content = `
    <tr>
      <td style="text-align:center;padding-bottom:32px;">
        <h1 style="margin:0 0 12px;font-size:28px;font-weight:600;color:${colors.text};letter-spacing:-0.02em;">${escapeEmailText(copy.greeting)}</h1>
        <p style="margin:0;font-size:17px;color:${colors.textSecondary};line-height:1.5;">${escapeEmailText(copy.instruction)}</p>
      </td>
    </tr>
    <tr>
      <td style="text-align:center;padding-bottom:32px;">
        <div style="display:inline-block;background-color:${colors.backgroundSecondary};border:2px solid ${colors.border};border-radius:12px;padding:20px 32px;">
          <span style="font-size:32px;font-weight:600;letter-spacing:6px;color:${colors.text};font-family:'SF Mono',SFMono-Regular,ui-monospace,Menlo,monospace;">${escapeEmailText(otp)}</span>
        </div>
      </td>
    </tr>
    <tr>
      <td style="text-align:center;">
        <p style="margin:0 0 8px;font-size:14px;color:${colors.textTertiary};">${escapeEmailText(copy.expiry)}</p>
        <p style="margin:0 0 8px;font-size:14px;color:${colors.textTertiary};">${escapeEmailText(copy.doNotShare)}</p>
        <p style="margin:0;font-size:13px;color:${colors.textTertiary};">${t.otp.ignoreMessage}</p>
      </td>
    </tr>`

  return {
    subject: withOtpSubject(copy.subject, otp),
    text: [
      baseOptions?.projectName,
      copy.greeting,
      copy.instruction,
      otp,
      copy.expiry,
      copy.doNotShare,
      t.otp.ignoreMessage,
    ]
      .filter(Boolean)
      .join('\n\n'),
    html: wrapInBaseTemplate(content, {
      ...baseOptions,
      preheader: copy.preheader,
      language,
      socialLinks,
    }),
  }
}
