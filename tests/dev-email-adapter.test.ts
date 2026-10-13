import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import axios from 'axios'
import { BasePayload } from 'payload'
import { createDevEmailAdapter, sendDevTestEmail } from '../dev/email'

const transport = vi.fn()
const originalTransport = axios.defaults.adapter
const message = { to: 'recipient@example.com', subject: 'Code: 123456', html: '<p>123456</p>' }

beforeEach(() => {
  axios.defaults.adapter = transport
  vi.stubEnv('NODE_ENV', 'development')
  vi.stubEnv('BREVO_API_KEY', 'test-api-key')
  vi.stubEnv('BREVO_SENDER_EMAIL', 'sender@example.com')
  vi.stubEnv('BREVO_SENDER_NAME', 'Demo')
  vi.stubEnv('BREVO_EMAILS_ACTIVE', 'true')
})
afterEach(() => {
  axios.defaults.adapter = originalTransport
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  vi.resetAllMocks()
})

it('configures Payload and standalone preview sending with the same Brevo adapter', async () => {
  transport.mockResolvedValue({ data: { messageId: 'test-id' } })
  const configured = createDevEmailAdapter()({ payload: new BasePayload() })
  expect(configured.name).toBe('brevo')
  expect(configured.defaultFromAddress).toBe('sender@example.com')
  await configured.sendEmail(message)
  await sendDevTestEmail(message)
  expect(transport).toHaveBeenCalledTimes(2)
  const request = transport.mock.calls[0][0]
  expect(request.url).toBe('https://api.brevo.com/v3/smtp/email')
  expect(JSON.parse(request.data)).toEqual({
    sender: { name: 'Demo', email: 'sender@example.com' },
    to: [{ email: message.to }],
    subject: message.subject,
    htmlContent: message.html,
  })
})

it('blocks disabled delivery, missing credentials and non-development preview sends before calling Brevo', async () => {
  vi.stubEnv('BREVO_EMAILS_ACTIVE', 'false')
  await expect(sendDevTestEmail(message)).rejects.toThrow('BREVO_EMAILS_ACTIVE')
  vi.stubEnv('BREVO_EMAILS_ACTIVE', 'true')
  vi.stubEnv('BREVO_API_KEY', '')
  await expect(sendDevTestEmail(message)).rejects.toThrow('BREVO_API_KEY')
  vi.stubEnv('NODE_ENV', 'production')
  await expect(sendDevTestEmail(message)).rejects.toThrow('only in development')
  expect(transport).not.toHaveBeenCalled()
})

it('does not claim successful delivery when the upstream adapter swallows an error', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  transport.mockRejectedValue(new Error('Provider rejected the request'))
  await expect(sendDevTestEmail(message)).rejects.toThrow('Brevo did not accept')
})
