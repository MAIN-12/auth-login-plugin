import { brevoAdapter } from '@main12/brevo-adapter'
import { BasePayload, type EmailAdapter } from 'payload'

/** Development adapter shared by Payload and the email preview sender. */
export function createDevEmailAdapter(): EmailAdapter {
  const apiKey = process.env.BREVO_API_KEY?.trim()
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim()
  const senderName = process.env.BREVO_SENDER_NAME?.trim() || 'Dev Test'
  const active = process.env.BREVO_EMAILS_ACTIVE === 'true'
  const createAdapter = brevoAdapter({ apiKey, senderEmail, senderName, active })

  return (args) => {
    const adapter = createAdapter(args)
    return {
      ...adapter,
      async sendEmail(message) {
        // The upstream adapter silently returns when disabled or missing a key.
        // Report these cases before calling it, rather than claiming a successful send.
        if (!active) throw new Error('Set BREVO_EMAILS_ACTIVE=true to send test emails.')
        if (!apiKey || !senderEmail)
          throw new Error('Configure BREVO_API_KEY and BREVO_SENDER_EMAIL in dev/.env.local.')
        const result: unknown = await adapter.sendEmail(message)
        if (!result || typeof result !== 'object' || !('messageId' in result) || !result.messageId)
          throw new Error('Brevo did not accept the email. Check your API key and verified sender.')
        return result
      },
    }
  }
}

/** Brevo does not use Payload/database state; previews can send without schema initialization. */
export async function sendDevTestEmail(message: { to: string; subject: string; html: string }) {
  if (process.env.NODE_ENV !== 'development')
    throw new Error('Test sending is available only in development.')
  const adapter = createDevEmailAdapter()({ payload: new BasePayload() })
  return adapter.sendEmail(message)
}
