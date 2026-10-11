'use server'

import { sendDevTestEmail } from '../../../email'
import { projectAuthEmails } from '../../../examples/auth-emails'
import { samples } from './templates'

export async function sendTestEmail(input: {
  template: string
  design: string
  name: string
  email: string
}): Promise<{ success: boolean; message: string }> {
  // This playground must not expose an arbitrary-recipient sender in production.
  if (process.env.NODE_ENV !== 'development') {
    return { success: false, message: 'Test sending is available only in development.' }
  }
  if (!input || typeof input.name !== 'string' || typeof input.email !== 'string') {
    return { success: false, message: 'Enter your name and a valid email address.' }
  }
  const name = input.name.trim()
  const email = input.email.trim()
  const selected = samples.find((sample) => sample.id === input.template)
  if (!selected || !['default', 'custom'].includes(input.design)) {
    return { success: false, message: 'Select a valid email template and design.' }
  }
  if (
    !name ||
    name.length > 100 ||
    email.length > 254 ||
    !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email) ||
    /[\r\n]/.test(email)
  ) {
    return {
      success: false,
      message: 'Enter a name (up to 100 characters) and a valid email address.',
    }
  }
  try {
    // Both built-in and project templates escape dynamic values.
    const custom = input.design === 'custom'
    const rendered = await selected.render(custom ? projectAuthEmails : {}, name, email)
    await sendDevTestEmail({
      to: email,
      subject: `[TEST] ${rendered.subject}`,
      html: rendered.html,
    })
    return {
      success: true,
      message: `Brevo accepted the test email for ${email}. Check your inbox or spam folder.`,
    }
  } catch {
    return {
      success: false,
      message:
        'Could not send the test email. Check BREVO_EMAILS_ACTIVE=true, the API key, and your verified Brevo sender in dev/.env.local.',
    }
  }
}
