import { createAuthProxy } from '@main12/auth-login/proxy'
const oauthAcceptance = process.env.AUTH_CONSUMER_OAUTH === '1'
export const proxy = createAuthProxy({ modalLogin: !oauthAcceptance, ...(oauthAcceptance ? { basePath: '/auth' } : {}) })
export const config = { matcher: ['/login', '/signup', '/forgot-password', '/verify-otp', '/set-password'] }
