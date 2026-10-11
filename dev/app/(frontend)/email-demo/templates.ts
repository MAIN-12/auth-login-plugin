import { renderAuthEmail, type AuthEmailOverrides } from '@main12/auth-login/rsc'

import { emailBranding } from '../../../examples/email-branding'

async function getBaseOptions() {
  return emailBranding
}

export const samples = [
  {
    id: 'welcome',
    title: 'Welcome',
    note: 'Optional template for your project to send after signup succeeds; not sent automatically.',
    render: async (
      overrides: AuthEmailOverrides,
      userName = 'Alex',
      userEmail = 'alex@example.com',
    ) =>
      renderAuthEmail(
        'welcome',
        {
          baseOptions: await getBaseOptions(),
          userName,
          userEmail,
          loginUrl: 'https://example.com/auth/login',
        },
        overrides,
      ),
  },
  {
    id: 'signup',
    title: 'Signup code',
    note: 'Sent by the OTP endpoint for signup.',
    render: async (
      overrides: AuthEmailOverrides,
      userName = 'Alex',
      userEmail = 'alex@example.com',
    ) =>
      renderAuthEmail(
        'otp',
        { baseOptions: await getBaseOptions(), userName, otp: '123456', purpose: 'signup' },
        overrides,
      ),
  },
  {
    id: 'login',
    title: 'Login code',
    note: 'Sent by the OTP endpoint for login.',
    render: async (
      overrides: AuthEmailOverrides,
      userName = 'Alex',
      userEmail = 'alex@example.com',
    ) =>
      renderAuthEmail(
        'otp',
        { baseOptions: await getBaseOptions(), userName, otp: '123456', purpose: 'login' },
        overrides,
      ),
  },
  {
    id: 'recovery',
    title: 'Recovery code',
    note: 'Sent by the OTP endpoint for password recovery.',
    render: async (
      overrides: AuthEmailOverrides,
      userName = 'Alex',
      userEmail = 'alex@example.com',
    ) =>
      renderAuthEmail(
        'otp',
        { baseOptions: await getBaseOptions(), userName, otp: '123456', purpose: 'password-reset' },
        overrides,
      ),
  },
  {
    id: 'reset',
    title: 'Password reset template',
    note: 'Optional template for your project to send. The built-in recovery flow uses the recovery code email above.',
    render: async (
      overrides: AuthEmailOverrides,
      userName = 'Alex',
      userEmail = 'alex@example.com',
    ) =>
      renderAuthEmail(
        'passwordReset',
        { baseOptions: await getBaseOptions(), userName, otp: '123456' },
        overrides,
      ),
  },
  {
    id: 'changed',
    title: 'Password changed',
    note: 'Optional template for your project to send after a successful password change; not sent automatically.',
    render: async (
      overrides: AuthEmailOverrides,
      userName = 'Alex',
      userEmail = 'alex@example.com',
    ) =>
      renderAuthEmail(
        'passwordChanged',
        {
          baseOptions: await getBaseOptions(),
          userName,
          loginUrl: 'https://example.com/auth/login',
        },
        overrides,
      ),
  },
]
