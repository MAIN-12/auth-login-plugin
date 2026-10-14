import { expect, it } from 'vitest'
import {
  generateOtpEmail,
  generatePasswordResetEmail,
  generateWelcomeEmail,
  generatePasswordChangedEmail,
} from '../src/shared/infrastructure/email/index'
import { DEFAULT_COLORS } from '../src/shared/domain/emailPresentation'

it.each(['en', 'es'] as const)(
  '%s distinguishes every purpose with branded code-first subjects and equivalent safe content',
  (language) => {
    const subjects = new Set<string>()
    for (const purpose of [
      'login',
      'signup',
      'verify-email',
      'password-reset',
      'reauth',
    ] as const) {
      const result = generateOtpEmail({
        userName: '<script>Owner & "Guest"</script>',
        otp: '012345',
        purpose,
        language,
        expiresAt: Date.UTC(2026, 9, 14, 15, 0),
        baseOptions: { projectName: '<Brand & "Company">', preheader: '012345' },
      })
      expect(result.subject).toMatch(/^012345: /)
      expect(result.subject).toContain('<Brand & "Company">')
      subjects.add(result.subject)
      expect(result.html).toContain(`<html lang="${language}">`)
      expect(result.html).toContain('&lt;script&gt;Owner &amp; &quot;Guest&quot;&lt;/script&gt;')
      expect(result.html).not.toContain('<script>')
      expect(result.html).toContain('2026-10-14 15:00:00 UTC')
      expect(result.text).toContain('2026-10-14 15:00:00 UTC')
      expect(result.text).toContain('012345')
      expect(result.text).toContain(language === 'es' ? 'No compartas' : 'Do not share')
      const preview = result.html.match(/display:none[^>]*>([^<]*)/)?.[1]
      expect(preview).toBeTruthy()
      expect(preview).not.toContain('012345')
      expect(preview).toContain('&lt;Brand')
    }
    expect(subjects.size).toBe(5)
  },
)

it.each(['en', 'es'] as const)(
  '%s manual recovery shares runtime copy and configurable expiry without rounding up',
  (language) => {
    for (const expiresInSeconds of [0, 1, 42.9, 59, 60, 120, 600]) {
      const params = { userName: '', otp: '012345', language, expiresInSeconds }
      const result = generatePasswordResetEmail(params)
      expect(result).toEqual(generateOtpEmail({ ...params, purpose: 'password-reset' }))
      const expected =
        expiresInSeconds > 0 && expiresInSeconds % 60 === 0
          ? expiresInSeconds / 60
          : Math.floor(expiresInSeconds)
      expect(result.text).toContain(`${expected} `)
      expect(result.html).not.toContain('Hi </h1>')
      expect(result.html).not.toContain('Hola </h1>')
    }
  },
)

it('omits unconfigured login CTAs, validates configured URLs and includes plain text alternatives', () => {
  for (const generate of [generateWelcomeEmail, generatePasswordChangedEmail]) {
    const withoutUrl = generate({ userName: '' })
    expect(withoutUrl.html).not.toContain('example.com')
    expect(withoutUrl.html).not.toContain('href=')
    expect(withoutUrl.text).toBeTruthy()
    const configured = generate({
      userName: 'Alex',
      baseOptions: { domain: 'https://app.example.test' },
    })
    expect(configured.html).toContain('https://app.example.test/login')
    expect(configured.text).toContain('https://app.example.test/login')
    expect(() => generate({ userName: '', loginUrl: 'http://unsafe.test' })).toThrow('HTTPS')
  }
})

it('rejects invalid lifetime and injected brand subjects in standalone exports', () => {
  for (const expiresInSeconds of [-1, Infinity, NaN]) {
    expect(() => generateOtpEmail({ userName: '', otp: '012345', expiresInSeconds })).toThrow(
      'expiry',
    )
  }
  expect(() =>
    generateOtpEmail({
      userName: '',
      otp: '012345',
      baseOptions: { projectName: 'Brand\r\nBcc: x' },
    }),
  ).toThrow('project name')
})

it('default functional text reaches 4.5:1 on both email backgrounds and primary CTA', () => {
  const luminance = (hex: string) => {
    const rgb = hex
      .slice(1)
      .match(/../g)!
      .map((part) => parseInt(part, 16) / 255)
      .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
  }
  const ratio = (a: string, b: string) => {
    const values = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (values[0] + 0.05) / (values[1] + 0.05)
  }
  for (const color of [
    DEFAULT_COLORS.text,
    DEFAULT_COLORS.textSecondary,
    DEFAULT_COLORS.textTertiary,
    DEFAULT_COLORS.accent,
  ]) {
    for (const background of [DEFAULT_COLORS.background, DEFAULT_COLORS.backgroundSecondary])
      expect(ratio(color, background)).toBeGreaterThanOrEqual(4.5)
  }
  expect(ratio(DEFAULT_COLORS.primaryText, DEFAULT_COLORS.primary)).toBeGreaterThanOrEqual(4.5)
})

it.each(['en', 'es'] as const)('%s uses singular units for one minute or second', (language) => {
  const params = { userName: '', otp: '012345', language }
  expect(generateOtpEmail({ ...params, expiresInSeconds: 1 }).text).toContain(
    language === 'es' ? '1 segundo.' : '1 second.',
  )
  expect(generateOtpEmail({ ...params, expiresInSeconds: 60 }).text).toContain(
    language === 'es' ? '1 minuto.' : '1 minute.',
  )
})
