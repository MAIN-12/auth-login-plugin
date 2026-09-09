'use client'

import type React from 'react'
import { pluginConfig, initClientConfig } from '../config'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import VerifyOtpPage from './pages/VerifyOtpPage'
import SetPasswordPage from './pages/SetPasswordPage'

export interface AuthPagesProps {
  /** The slug segments from the catch-all route, e.g. ['login'] or ['forgot-password'] */
  slug?: string[]

  /** Where to redirect after successful login / set-password */
  redirectTo?: string

  /** Optional logo component */
  logo?: React.ReactNode

  /** Custom handler for password login (email+password). If omitted, uses default fetch to /api/users/login */
  onPasswordLogin?: (credentials: { email: string; password: string }) => Promise<void>

  /** Custom handler for signup. If omitted, uses default fetch to /api/auth/signup */
  onSignup?: (data: { name: string; email: string }) => Promise<void>

  /** Base path prefix, defaults to '/auth'. Used to compute sibling URLs. */
  basePath?: string

  /** Show Google OAuth buttons. If omitted, reads from plugin config. */
  showGoogleOAuth?: boolean

  /** Override the page background. Defaults to 'bg-white md:bg-[#191919]'. */
  backgroundClass?: string

  /** UI style override. If omitted, reads from plugin config. */
  style?: 'tailwind' | 'hero-ui'

  /** Allow new user signups. When false, hides signup page and signup links. Defaults to true. */
  allowSignup?: boolean
  /** Allow password-based login. @default true */
  passwordLogin?: boolean
  /** Allow OTP-based login. @default true */
  otpLogin?: boolean
}

const defaultPasswordLogin = async ({ email, password }: { email: string; password: string }) => {
  const res = await fetch('/api/users/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.errors?.[0]?.message || 'Login failed')
  }
}

const defaultSignup = async ({ name, email }: { name: string; email: string }) => {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.message || 'Signup failed')
  }
}

export default function AuthPages({
  slug,
  redirectTo = '/admin',
  logo,
  onPasswordLogin = defaultPasswordLogin,
  onSignup = defaultSignup,
  basePath = '/auth',
  showGoogleOAuth,
  backgroundClass,
  style,
  allowSignup = true,
  passwordLogin = true,
  otpLogin = true,
}: AuthPagesProps) {
  // Sync server plugin config to client using props (which come from the server via AuthPagesServer)
  initClientConfig({
    style: style ?? pluginConfig.style,
    googleOAuthEnabled: showGoogleOAuth ?? pluginConfig.googleOAuthEnabled,
    passwordLogin,
    otpLogin,
  })

  const page = slug?.[0] ?? 'login'
  const base = basePath.replace(/\/$/, '')

  const shared = {
    logo,
    ...(showGoogleOAuth !== undefined ? { showGoogleOAuth } : {}),
    ...(backgroundClass !== undefined ? { backgroundClass } : {}),
  }

  switch (page) {
    case 'login':
      return (
        <LoginPage
          onPasswordLogin={onPasswordLogin}
          redirectTo={redirectTo}
          signupUrl={allowSignup ? `${base}/signup` : undefined}
          {...shared}
        />
      )
    case 'signup':
      if (!allowSignup) {
        return (
          <LoginPage
            onPasswordLogin={onPasswordLogin}
            redirectTo={redirectTo}
            {...shared}
          />
        )
      }
      return (
        <SignupPage
          onSignup={onSignup}
          loginUrl={`${base}/login`}
          {...shared}
        />
      )
    case 'forgot-password':
      return <ForgotPasswordPage loginUrl={`${base}/login`} {...shared} />
    case 'verify-otp':
      return <VerifyOtpPage loginUrl={`${base}/login`} {...shared} />
    case 'set-password':
      return <SetPasswordPage redirectTo={redirectTo} {...shared} />
    default:
      return <LoginPage onPasswordLogin={onPasswordLogin} redirectTo={redirectTo} signupUrl={`${base}/signup`} {...shared} />
  }
}
