import { NextResponse, type NextRequest } from 'next/server'
import type { PublicAuthConfig } from './config'

const AUTH_ROUTES = ['login', 'signup', 'forgot-password', 'verify-otp', 'set-password']

export interface AuthProxyOptions {
  /** Explicitly enable modal mode in separately bundled proxy runtimes. */
  publicConfig?: PublicAuthConfig
  modalLogin?: boolean
  /** Base path where AuthPages catch-all is mounted. Defaults to '/auth' */
  basePath?: string
  /** Routes to redirect. Defaults to all auth routes. */
  routes?: string[]
}

/** Canonicalizes configured auth paths only. Pass publicConfig or explicit basePath.
 * The default export is deliberately inert; no separately bundled globals are read.
 * Authentication/authorization belongs to the consumer's server guard, never cookies here.
 */
export function createAuthProxy({ basePath, routes = AUTH_ROUTES, modalLogin, publicConfig }: AuthProxyOptions = {}) {
  const routeSet = new Set(routes)

  return function proxy(request: NextRequest) {
    if (modalLogin ?? publicConfig?.modalLogin) return NextResponse.next()

    const base = (basePath ?? publicConfig?.authBasePath ?? '/auth').replace(/\/$/, '')
    const redirectsEnabled = publicConfig?.routeRedirects
    if (!redirectsEnabled && !basePath) {
      return NextResponse.next()
    }

    const { pathname } = request.nextUrl

    // A cookie is not proof of authentication. Proxy only canonicalizes paths.
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
