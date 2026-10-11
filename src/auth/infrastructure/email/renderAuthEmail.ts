import { withOtpSubject } from '../../domain/emailPresentation'
import { generateOtpEmail } from './templates/otp'
import { generateWelcomeEmail } from './templates/welcome'
import { generatePasswordResetEmail } from './templates/passwordReset'
import { generatePasswordChangedEmail } from './templates/passwordChanged'

import type {
  AuthEmailParams,
  AuthEmailResult,
  AuthEmailOverrides,
} from '../../domain/emailTemplates'
export type {
  AuthEmailParams,
  AuthEmailResult,
  AuthEmailOverrides,
} from '../../domain/emailTemplates'

const defaults: { [K in keyof AuthEmailParams]: (params: AuthEmailParams[K]) => AuthEmailResult } =
  {
    otp: generateOtpEmail,
    welcome: generateWelcomeEmail,
    passwordReset: generatePasswordResetEmail,
    passwordChanged: generatePasswordChangedEmail,
  }

/** Render only: delivery remains with the project's Payload email adapter. */
export async function renderAuthEmail<K extends keyof AuthEmailParams>(
  type: K,
  params: AuthEmailParams[K],
  overrides: AuthEmailOverrides = {},
): Promise<AuthEmailResult> {
  const result = await (overrides[type] ?? defaults[type])(params)
  if (
    !result ||
    typeof result.subject !== 'string' ||
    typeof result.html !== 'string' ||
    !result.subject.trim() ||
    !result.html.trim() ||
    /[\r\n]/.test(result.subject)
  ) {
    throw new Error('auth-login: email renderer must return a subject and HTML')
  }
  // Only return content: renderers cannot override recipients or delivery options.
  const subject =
    (type === 'otp' || type === 'passwordReset') && 'otp' in params
      ? withOtpSubject(result.subject, params.otp)
      : result.subject
  return { subject, html: result.html }
}
