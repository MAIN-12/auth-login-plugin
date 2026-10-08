import { expect, it } from 'vitest'
import { generateOtpEmail, generatePasswordResetEmail } from '../src/auth/infrastructure/email'
import { getEmailTranslations } from '../src/i18n/email'

it.each(['en', 'es'] as const)(
  '%s login and password-reset templates localize content, escape dynamic values, and hide OTP from previews',
  (language) => {
    const translations = getEmailTranslations(language)
    const otp = '918273'
    const params = {
      userName: '<script>Owner & "Guest"</script>',
      otp,
      language,
      baseOptions: {
        projectName: '<Brand & "Company">',
        userEmail: '<recipient@example.test>',
        preheader: `untrusted preview ${otp}`,
      },
    }
    const cases = [
      {
        result: generateOtpEmail(params),
        subject: translations.otp.subjectLogin,
        preheader: translations.otp.preheader,
        purpose: translations.otp.purposeLogin,
      },
      {
        result: generateOtpEmail({ ...params, purpose: 'password-reset' }),
        subject: translations.otp.subjectPasswordReset,
        preheader: translations.otp.preheader,
        purpose: translations.otp.purposePasswordReset,
      },
      {
        result: generatePasswordResetEmail(params),
        subject: translations.passwordReset.subject,
        preheader: translations.passwordReset.preheader,
        purpose: translations.passwordReset.title,
      },
    ]
    for (const { result, subject, preheader, purpose } of cases) {
      expect(result.subject).toBe(subject)
      expect(result.subject).not.toContain(otp)
      expect(result.html).toContain(`<html lang="${language}">`)
      expect(result.html).toContain(purpose)
      expect(result.html).toContain(otp)
      expect(result.html).toContain('&lt;script&gt;Owner &amp; &quot;Guest&quot;&lt;/script&gt;')
      expect(result.html).toContain('&lt;Brand &amp; &quot;Company&quot;&gt;')
      expect(result.html).toContain('&lt;recipient@example.test&gt;')
      expect(result.html).not.toContain('<script>')
      const preview = result.html.match(/display:none[^>]*>([^<]*)/)?.[1]
      expect(preview).toBe(preheader)
      expect(preview).not.toContain(otp)
    }
  },
)
