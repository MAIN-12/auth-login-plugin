import { NextResponse, type NextRequest } from 'next/server'
import { pluginConfig } from './config'

const AUTH_ROUTES = ['login', 'signup', 'forgot-password', 'verify-otp', 'set-password']

export interface AuthProxyOptions {
  /** Base path where AuthPages catch-all is mounted. Defaults to '/auth' */
  basePath?: string
  /** Routes to redirect. Defaults to all auth routes. */
  routes?: string[]
}

/**
 * Creates a proxy that redirects bare auth routes (e.g. /login)
 * to the catch-all path (e.g. /auth/login).
 *
 * Usage in your app's proxy.ts (Next.js 16+):
 * ```ts
 * // One-liner — just re-export:
 * export { proxy, config } from '@main12/auth-login/proxy'
 * ```
 * Or compose with your own logic:
 * ```ts
 * import { createAuthProxy } from '@main12/auth-login/proxy'
 * const authProxy = createAuthProxy({ basePath: '/auth' })
 * export function proxy(req) { return authProxy(req) }
 * ```
 *
 * The basePath defaults to the value set in the plugin options
 * (`routeRedirects: { basePath: '/auth' }`), or '/auth' if not configured.
 */
export function createAuthProxy({ basePath, routes = AUTH_ROUTES }: AuthProxyOptions = {}) {
  const base = (basePath ?? pluginConfig.authBasePath).replace(/\/$/, '')
  const routeSet = new Set(routes)

  return function proxy(request: NextRequest) {
    // Check route redirects — use env var (set by plugin) as it survives module boundaries
    const redirectsEnabled = pluginConfig.routeRedirects || process.env.AUTH_PLUGIN_ROUTE_REDIRECTS === 'true'
    if (!redirectsEnabled && !basePath) {
      return NextResponse.next()
    }

    const { pathname } = request.nextUrl

    // If user is already logged in, redirect away from auth pages (login, signup, etc.)
    const token = request.cookies.get('payload-token')?.value
    if (token) {
      const segment = pathname.replace(/^\//, '').replace(/\/$/, '')
      const isAuthPage = routeSet.has(segment) || routeSet.has(pathname.replace(`${base}/`, ''))
      if (isAuthPage || pathname.startsWith(`${base}/login`) || pathname.startsWith(`${base}/signup`)) {
        const redirect = request.nextUrl.searchParams.get('redirect') || '/'
        const url = request.nextUrl.clone()
        url.pathname = redirect
        url.search = ''
        return NextResponse.redirect(url)
      }
    }

    // Always redirect /admin/login to the plugin login page
    if (pathname === '/admin/login' || pathname === '/admin/login/') {
      const url = request.nextUrl.clone()
      url.pathname = `${base}/login`
      return NextResponse.redirect(url)
    }

    const segment = pathname.replace(/^\//, '').replace(/\/$/, '')

    if (routeSet.has(segment) && !pathname.startsWith(`${base}/`)) {
      const url = request.nextUrl.clone()
      url.pathname = `${base}/${segment}`
      return NextResponse.redirect(url)
    }

    return NextResponse.next()
  }
}

export const proxy = createAuthProxy()

export const config = {
  matcher: [
    '/admin/login', 
    '/login', 
    '/signup', 
    '/forgot-password', 
    '/verify-otp', 
    '/set-password',
    '/auth/:path*',
  ],
}
