import { authLoginPlugin } from '@main12/auth-login'

const googleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_REDIRECT_URI,
)

export const authPlugin = authLoginPlugin({
  // Installation fallback; the frontend provider chooses the effective language.
  locale: 'en',
  projectName: 'Dev Test',
  style: 'hero-ui',
  modalLogin: true,
  passwordLogin: true,
  // Enable email flows only after supplying otp secret, sender and trusted peer resolver.
  otpLogin: false,
  allowSignup: false,
  recovery: false,
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
