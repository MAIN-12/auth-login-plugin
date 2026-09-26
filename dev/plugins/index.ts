import { authLoginPlugin } from '@main12/auth-login'

export const authPluginOptions = {
  projectName: 'Dev Test',
  domain: 'http://localhost:3000',
  style: 'hero-ui' as const,
  passwordLogin: false,
  otpLogin: true,
  allowSignup: false,
  routeRedirects: true,
  providers: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
  },
}

export const plugins = [
  authLoginPlugin(authPluginOptions),
]