import { afterEach, expect, it, vi } from 'vitest'

vi.mock('@main12/auth-login/rsc', async () => ({
  renderAuthEmail: (await import('../src/auth/infrastructure/email/renderAuthEmail'))
    .renderAuthEmail,
}))
vi.mock('../dev/email', () => ({ sendDevTestEmail: vi.fn() }))

import { sendDevTestEmail } from '../dev/email'
import { sendTestEmail } from '../dev/app/(frontend)/email-demo/actions'
import { samples } from '../dev/app/(frontend)/email-demo/templates'
import { projectAuthEmails } from '../dev/examples/auth-emails'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

it('renders every preview with both designs and escapes recipient names', async () => {
  for (const sample of samples) {
    for (const overrides of [{}, projectAuthEmails]) {
      const mail = await sample.render(overrides, '<script>alert(1)</script>', 'alex@example.com')
      expect(mail.subject).toBeTruthy()
      expect(mail.html).toContain('<!doctype html>')
      expect(mail.html).not.toContain('<script>')
      expect(mail.html).toContain('Dev Test')
      if (['signup', 'login', 'recovery', 'reset'].includes(sample.id)) {
        expect(mail.subject).toContain('123456')
      } else {
        expect(mail.subject).not.toContain('123456')
      }
    }
  }
})

it('rejects test delivery outside development, invalid inputs, and adapter failures', async () => {
  const input = { template: 'login', design: 'custom', name: 'Alex', email: 'alex@example.com' }
  vi.stubEnv('NODE_ENV', 'production')
  expect((await sendTestEmail(input)).success).toBe(false)
  vi.stubEnv('NODE_ENV', 'development')
  expect((await sendTestEmail({ ...input, template: 'invalid' })).success).toBe(false)
  expect((await sendTestEmail({ ...input, email: 'invalid\r\naddress' })).success).toBe(false)
  expect(sendDevTestEmail).not.toHaveBeenCalled()
  vi.mocked(sendDevTestEmail).mockRejectedValueOnce(new Error('Provider failed'))
  expect((await sendTestEmail(input)).success).toBe(false)
})

it('reports provider acceptance only after the configured sender succeeds', async () => {
  vi.stubEnv('NODE_ENV', 'development')
  vi.mocked(sendDevTestEmail).mockResolvedValueOnce({ messageId: 'test-message-id' })
  const result = await sendTestEmail({
    template: 'login',
    design: 'custom',
    name: 'Alex',
    email: 'alex@example.com',
  })
  expect(result.success).toBe(true)
  expect(result.message).toContain('Brevo accepted')
  expect(sendDevTestEmail).toHaveBeenCalledWith(
    expect.objectContaining({
      to: 'alex@example.com',
      subject: expect.stringContaining('123456'),
    }),
  )
})
