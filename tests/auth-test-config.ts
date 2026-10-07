import { resolveAuthConfig } from '../src/config'
export const publicConfig = resolveAuthConfig({
  passwordLogin: true,
  otpLogin: false,
  providers: { google: false },
  allowSignup: false,
  recovery: false,
  logo: '/plugin-logo.svg',
})
