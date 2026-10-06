import { createAuthProxy } from '@main12/auth-login/proxy'
export const proxy = createAuthProxy({ modalLogin: true })
export const config = { matcher: ['/login', '/signup'] }
