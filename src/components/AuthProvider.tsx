'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AuthPresentationProps } from './auth-presentation/types'
import { AuthPresentationContext, useAuthPresentation } from './auth-presentation/AuthPresentationContext'
import { mergeAuthPresentation } from './auth-presentation/resolvePresentation'
import { AuthFlowContext } from '../auth/application/AuthFlowContext'
import { safeAuthRedirect } from '../auth/domain/redirect'
import { AuthCard, type AuthCardWithSlugProps } from './AuthCard'
import { AuthModal } from './AuthModal'
import type { AuthFormSlug } from './forms'
import { getUiTranslations } from './ui/translations'

export interface AuthUser {
  id: string | number
  email?: string
}
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error'
export interface OpenLoginOptions {
  /** Defaults to keeping the current page, including its query string and hash. */
  redirectTo?: string
}
export interface AuthContextValue<TUser extends AuthUser = AuthUser> {
  user: TUser | null
  status: AuthStatus
  error: Error | null
  isLoginOpen: boolean
  openLogin: (options?: OpenLoginOptions) => void
  closeLogin: () => void
  refreshSession: () => Promise<TUser | null>
  logout: () => Promise<void>
  /** Verify the server session; prompt for login when unauthenticated. Network errors reject. */
  isLoggedIn: (options?: OpenLoginOptions) => Promise<boolean>
  /** Alias for isLoggedIn. */
  isLogedin: (options?: OpenLoginOptions) => Promise<boolean>
}
export interface AuthProviderProps extends AuthPresentationProps {
  children: React.ReactNode
  modalLogin?: boolean
  /** Pass null for a known anonymous session, or omit to load /api/users/me. */
  initialUser?: AuthUser | null
  /** Modal-only overrides. Use top-level locale/messages/logo/poweredBy for shared defaults. */
  authCardProps?: Omit<AuthCardWithSlugProps, 'slug' | 'redirectTo'>
  basePath?: string
  modalLabel?: string
  closeLabel?: string
}
const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth<TUser extends AuthUser = AuthUser>(): AuthContextValue<TUser> {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value as AuthContextValue<TUser>
}

const formSlugs = new Set(['login', 'signup', 'forgot-password', 'verify-otp', 'set-password'])

export function AuthProvider({
  children, modalLogin = false, style, locale, messages, logo, poweredBy, initialUser, authCardProps = {},
  basePath = '/auth', modalLabel, closeLabel,
}: AuthProviderProps) {
  const presentation = useAuthPresentation({ style, locale, messages, logo, poweredBy })
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(initialUser ?? null)
  const [status, setStatus] = useState<AuthStatus>(initialUser === undefined ? 'loading' : initialUser ? 'authenticated' : 'unauthenticated')
  const [error, setError] = useState<Error | null>(null)
  const [flow, setFlow] = useState<{ id: number; slug: AuthFormSlug; search: string; destination: string; redirect: boolean } | null>(null)
  const flowId = useRef(0)
  const sessionRequest = useRef(0)
  const base = basePath.replace(/\/$/, '')

  const refreshSession = useCallback(async () => {
    const request = ++sessionRequest.current
    try {
      const response = await fetch('/api/users/me', { credentials: 'include', cache: 'no-store' })
      if (!response.ok && response.status !== 401) throw new Error('Unable to load the current session')
      const data = response.status === 401 ? { user: null } : await response.json()
      const nextUser = data.user ?? null
      if (request !== sessionRequest.current) throw new Error('Session check was superseded; please retry')
      setUser(nextUser)
      setStatus(nextUser ? 'authenticated' : 'unauthenticated')
      setError(null)
      return nextUser as AuthUser | null
    } catch (cause) {
      const failure = cause instanceof Error ? cause : new Error('Unable to load the current session')
      if (request === sessionRequest.current) { setError(failure); setStatus('error') }
      throw failure
    }
  }, [])

  useEffect(() => {
    if (initialUser === undefined) void refreshSession().catch(() => {})
    return () => { sessionRequest.current++ }
  }, [initialUser, refreshSession])

  const closeLogin = useCallback(() => {
    flowId.current++
    setFlow(null)
    // OTP may already have established a session before the password step is dismissed.
    void refreshSession().catch(() => {})
  }, [refreshSession])

  const openLogin = useCallback((options: OpenLoginOptions = {}) => {
    const destination = safeAuthRedirect(options.redirectTo ?? (window.location.pathname + window.location.search + window.location.hash))
    if (!modalLogin) {
      router.push(base + '/login?redirect=' + encodeURIComponent(destination))
      return
    }
    setFlow({ id: ++flowId.current, slug: 'login', search: '', destination, redirect: options.redirectTo !== undefined })
  }, [base, modalLogin, router])

  const isLoggedIn = useCallback(async (options?: OpenLoginOptions) => {
    const currentUser = await refreshSession()
    if (currentUser) return true
    openLogin(options)
    return false
  }, [refreshSession, openLogin])

  const logout = useCallback(async () => {
    ++sessionRequest.current
    const response = await fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
    if (!response.ok) throw new Error('Logout failed')
    ++sessionRequest.current
    ++flowId.current
    setFlow(null)
    setUser(null)
    setStatus('unauthenticated')
    setError(null)
    router.refresh()
  }, [router])

  const navigation = useMemo(() => {
    if (!flow) return null
    const searchParams = new URLSearchParams(flow.search)
    searchParams.set('redirect', flow.destination)
    return {
      searchParams,
      push: (href: string) => {
        if (flow.id !== flowId.current) return
        const url = new URL(href, window.location.origin)
        const slug = url.pathname.split('/').filter(Boolean).pop() as AuthFormSlug
        if (url.origin !== window.location.origin || !formSlugs.has(slug)) return
        setFlow(current => current?.id === flow.id ? { ...current, slug, search: url.search } : current)
      },
      complete: async () => {
        const authenticatedUser = await refreshSession()
        if (!authenticatedUser) throw new Error('The login session could not be verified')
        if (flow.id !== flowId.current) return
        ++flowId.current
        setFlow(null)
        if (flow.redirect) router.push(flow.destination)
        router.refresh()
      },
    }
  }, [flow, refreshSession, router])

  const value = useMemo(() => ({ user, status, error, isLoginOpen: Boolean(flow), openLogin, closeLogin, refreshSession, logout, isLoggedIn, isLogedin: isLoggedIn }),
    [user, status, error, flow, openLogin, closeLogin, refreshSession, logout, isLoggedIn])
  const modalPresentation = mergeAuthPresentation(presentation, authCardProps)
  const modalLocale = modalPresentation.locale ?? presentation.locale
  const t = getUiTranslations(modalLocale, modalPresentation.messages)

  return (
    <AuthPresentationContext.Provider value={presentation}>
      <AuthContext.Provider value={value}>
        {children}
        {modalLogin && flow && navigation && (
          <AuthModal style={modalPresentation.style ?? presentation.style} label={modalLabel ?? t.login.title} closeLabel={closeLabel ?? (modalLocale.startsWith('es') ? 'Cerrar' : 'Close')} onClose={closeLogin}>
            <AuthFlowContext.Provider value={navigation}>
              <AuthCard {...authCardProps} key={flow.id + ':' + flow.slug + ':' + flow.search}
                slug={flow.slug} basePath={base} redirectTo={flow.destination} locale={modalLocale}
                mobileVariant="modal" removeBorder removeShadow />
            </AuthFlowContext.Provider>
          </AuthModal>
        )}
      </AuthContext.Provider>
    </AuthPresentationContext.Provider>
  )
}
