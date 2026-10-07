import type { OtpOptions } from '../../config'
import { generateOtpEmail } from '../../components/email/templates/otp'
/** Runtime and exported generators share the same escaped, per-instance renderer. */
export function otpEmail(code: string, settings?: OtpOptions['email']) {
  return generateOtpEmail({
    userName: '',
    otp: code,
    language: settings?.locale ?? 'en',
    baseOptions: { ...settings, language: settings?.locale ?? 'en' },
  })
}
