import { authLoginPlugin } from '@main12/auth-login'

export const plugins = [
  authLoginPlugin({
    projectName: 'Dev Test',
    domain: 'http://localhost:3000',
    style: 'hero-ui',
    // style: 'tailwind',
    passwordLogin: false,
    otpLogin: true,
    allowSignup: false,
    routeRedirects: true,
    providers: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      }
    }
  }),
]