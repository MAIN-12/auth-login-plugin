// Copy this file into your project, then pass projectAuthEmails to authLoginPlugin({ emails }).
import type { AuthEmailOverrides, AuthEmailResult } from '@main12/auth-login'

type EmailBranding = { projectName?: string; contactEmail?: string; logoUrl?: string }

const brand = {
  name: 'Your Project',
  loginUrl: 'https://example.com/auth/login',
  supportEmail: 'support@example.com',
  accent: '#4338ca',
}

// Escape dynamic names, codes, and URLs before inserting them into email HTML.
export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  )
}

/** Shared header, background, card, footer, and preheader for every custom email. */
export function projectEmailLayout(
  content: string,
  preheader: string,
  branding: EmailBranding = {},
): string {
  const name = branding.projectName ?? brand.name
  const supportEmail = branding.contactEmail ?? brand.supportEmail
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(preheader)}</title></head>
<body style="margin:0;background:#f1f5f9;color:#0f172a;font-family:Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;">
<tr><td style="padding:28px 32px;background:${brand.accent};color:#fff;font-size:20px;font-weight:bold;">${branding.logoUrl ? `<img src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(name)}" width="200" style="display:block;max-width:100%;height:auto;">` : escapeHtml(name)}</td></tr>
<tr><td style="padding:32px;line-height:1.6;">${content}</td></tr>
<tr><td style="padding:24px 32px;border-top:1px solid #e2e8f0;color:#64748b;font-size:13px;">Contact our team: <a href="mailto:${escapeHtml(supportEmail)}" style="color:${brand.accent};">${escapeHtml(supportEmail)}</a><br>Sent by ${escapeHtml(name)} · ${new Date().getFullYear()}</td></tr>
</table></td></tr></table></body></html>`
}

// Edit wording here independently of the shared layout. This example uses English;
// callbacks receive the effective `language` from authentication flows or manual rendering.
const copy = {
  login: {
    subject: 'Your sign-in code',
    title: 'Let’s get you signed in',
    message: 'Enter this code on the sign-in screen to continue.',
  },
  signup: {
    subject: 'Confirm your email',
    title: 'One last step to join us',
    message: 'Enter this code to confirm your email and finish getting started.',
  },
  'password-reset': {
    subject: 'Your recovery code',
    title: 'Let’s recover your account',
    message: 'Enter this code on the recovery screen to continue.',
  },
  welcome: {
    subject: 'Welcome aboard!',
    title: 'Your account is ready',
    message: 'You’re all set. Open your account to start exploring.',
    action: 'Open my account',
  },
  passwordReset: {
    subject: 'Reset your password',
    title: 'A fresh start for your password',
    message: 'Use this code to verify your recovery request.',
  },
  passwordChanged: {
    subject: 'Your password was updated',
    title: 'Password updated',
    message:
      'Your new password is ready to use. If you didn’t make this change, contact our team immediately.',
    action: 'Sign in securely',
  },
}

function render(
  userName: string,
  wording: { subject: string; title: string; message: string },
  extra = '',
  branding: EmailBranding = {},
): AuthEmailResult {
  return {
    subject: `${branding.projectName ?? brand.name} · ${wording.subject}`,
    html: projectEmailLayout(
      `<h1 style="margin:0 0 20px;font-size:26px;line-height:1.2;">${escapeHtml(wording.title)}</h1><p>Hello ${escapeHtml(userName)},</p><p>${escapeHtml(wording.message)}</p>${extra}`,
      wording.subject,
      branding,
    ),
  }
}

function codeBlock(otp: string, expiresInSeconds = 300, expiresAt?: number): string {
  const expiry =
    expiresAt === undefined
      ? `This code expires in ${Math.max(0, Math.floor(expiresInSeconds))} seconds.`
      : `This code expires at ${new Date(expiresAt).toISOString()} (UTC).`
  return `<p style="padding:20px;background:#eef2ff;border-radius:12px;text-align:center;font-size:32px;font-weight:bold;letter-spacing:6px;">${escapeHtml(otp)}</p><p style="font-size:13px;color:#64748b;">${escapeHtml(expiry)} Never share it. If you didn’t request it, you can ignore this email.</p>`
}

function action(label: string): string {
  // Use your trusted application URL rather than a URL supplied by an incoming request.
  return `<p style="margin-top:28px;"><a href="${escapeHtml(brand.loginUrl)}" style="display:inline-block;padding:14px 24px;border-radius:10px;background:${brand.accent};color:#fff;text-decoration:none;font-weight:bold;">${escapeHtml(label)}</a></p>`
}

export const projectAuthEmails: AuthEmailOverrides = {
  otp: ({ userName, otp, purpose = 'login', baseOptions, expiresInSeconds, expiresAt }) =>
    render(
      userName,
      copy[purpose === 'verify-email' || purpose === 'reauth' ? 'signup' : purpose],
      codeBlock(otp, expiresInSeconds, expiresAt),
      baseOptions,
    ),
  welcome: ({ userName, baseOptions }) =>
    render(userName, copy.welcome, action(copy.welcome.action), baseOptions),
  passwordReset: ({ userName, otp, baseOptions, expiresInSeconds, expiresAt }) =>
    render(userName, copy.passwordReset, codeBlock(otp, expiresInSeconds, expiresAt), baseOptions),
  passwordChanged: ({ userName, baseOptions }) =>
    render(userName, copy.passwordChanged, action(copy.passwordChanged.action), baseOptions),
}
