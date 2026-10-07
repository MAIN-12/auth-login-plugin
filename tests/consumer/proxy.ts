import { createAuthProxy } from '@main12/auth-login/proxy'
const integration = process.env.AUTH_CONSUMER_ISSUE05 === '1'
const oauthAcceptance = process.env.AUTH_CONSUMER_OAUTH === '1'
export const proxy = createAuthProxy({
  modalLogin: !oauthAcceptance && !integration,
  ...(integration ? { basePath: '/members' } : oauthAcceptance ? { basePath: '/auth' } : {}),
})
export const config = {
  matcher: ['/login', '/signup', '/forgot-password', '/verify-otp', '/set-password'],
}
