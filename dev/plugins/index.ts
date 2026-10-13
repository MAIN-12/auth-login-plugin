import { authLoginPlugin } from '@main12/auth-login'
import { projectAuthEmails } from '../examples/auth-emails'
import { emailBranding } from '../examples/email-branding'

const googleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_REDIRECT_URI,
)

export const authPlugin = authLoginPlugin({
  // Installation fallback; the frontend provider chooses the effective language.
  locale: 'en',
  projectName: emailBranding.projectName,
  logo: emailBranding.logoUrl,
  contactEmail: emailBranding.contactEmail,
  emailAccentColor: emailBranding.colors?.primary,
  emails: projectAuthEmails,
  style: 'hero-ui',
  theme: 'inherit',
  modalLogin: true,
  passwordLogin: true,
  // Email flows use the configured Brevo sender and a shared development-only rate-limit bucket.
  otpLogin: false,
  allowSignup: true,
  recovery: false,
  otp: {
    // All development callers share one budget; never trust forwarded IP headers here.
    // Production hosts must supply their own trusted peer resolver.
    origin: () => (process.env.NODE_ENV === 'development' ? 'local-development' : null),
    email: {
      ...emailBranding,
      from: process.env.BREVO_SENDER_EMAIL || '',
      locale: 'en',
    },
  },
  routeRedirects: true,
  providers: {
    google: {
      enabled: googleConfigured,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectURI: process.env.GOOGLE_REDIRECT_URI,
    },
  },
})

export const plugins = [authPlugin]
