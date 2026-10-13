import { renderAuthEmail } from '../../../shared/infrastructure/email/renderAuthEmail'
import type { OtpEmailParams } from '../../../shared/domain/emailTemplates'
import type { OtpOptions } from '../../../configuration/plugin/config'
import { generateOtpEmail } from '../../../shared/infrastructure/email/templates/otp'
/** Runtime and exported generators share the same escaped, per-instance renderer. */
export function otpEmail(code: string, settings?: OtpOptions['email']) {
  return generateOtpEmail({
    userName: '',
    otp: code,
    language: settings?.locale ?? 'en',
    baseOptions: { ...settings, language: settings?.locale ?? 'en' },
  })
}

export function renderOtpEmail(
  code: string,
  settings: OtpOptions['email'],
  emails?: OtpOptions['emails'],
  purpose: OtpEmailParams['purpose'] = 'login',
  expiresInSeconds = 300,
) {
  return renderAuthEmail(
    'otp',
    {
      userName: '',
      otp: code,
      purpose,
      expiresInSeconds,
      language: settings?.locale ?? 'en',
      baseOptions: { ...settings, language: settings?.locale ?? 'en' },
    },
    emails,
  )
}
