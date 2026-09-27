// Initialize the plugin's settings in this server runtime too.
import './plugins'

export { proxy } from '@main12/auth-login/proxy'

// Next.js statically analyzes this matcher, so keep it literal.
export const config = {
  matcher: ['/admin/login', '/login', '/signup', '/forgot-password', '/verify-otp', '/set-password', '/auth/:path*'],
}
