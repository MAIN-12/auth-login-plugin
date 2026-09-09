import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const AUTH_ROUTES = new Set(['login', 'signup', 'forgot-password', 'verify-otp', 'set-password'])
const BASE = '/auth'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always redirect /admin/login
  if (pathname === '/admin/login' || pathname === '/admin/login/') {
    const url = request.nextUrl.clone()
    url.pathname = `${BASE}/login`
    return NextResponse.redirect(url)
  }

  // Redirect bare auth routes to /auth/*
  const segment = pathname.replace(/^\//, '').replace(/\/$/, '')
  if (AUTH_ROUTES.has(segment)) {
    const url = request.nextUrl.clone()
    url.pathname = `${BASE}/${segment}`
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/login', '/login', '/signup', '/forgot-password', '/verify-otp', '/set-password'],
}
