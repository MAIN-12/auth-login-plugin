'use client'

import { safeAuthRedirect } from '../../domain/redirect'
import React, { createContext, useCallback, useContext, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/** Scoped to modal content; standalone auth pages retain their normal navigation. */
export interface AuthFlowNavigation {
  push: (url: string) => void
  complete: (redirectTo: string) => Promise<void>
  searchParams: URLSearchParams
}
export const AuthFlowContext = createContext<AuthFlowNavigation | null>(null)

export function useAuthNavigation() {
  const flow = useContext(AuthFlowContext)
  const router = useRouter()
  const push = useCallback(
    (url: string) => {
      if (flow) flow.push(url)
      else router.push(url)
    },
    [flow, router],
  )
  const complete = useCallback(
    async (redirectTo: string) => {
      if (flow) await flow.complete(safeAuthRedirect(redirectTo))
      else window.location.href = safeAuthRedirect(redirectTo)
    },
    [flow],
  )
  return useMemo(() => ({ push, complete }), [push, complete])
}

export function useAuthSearchParams() {
  const flow = useContext(AuthFlowContext)
  const params = useSearchParams()
  return flow?.searchParams ?? params
}

export function AuthLink({ onClick, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const flow = useContext(AuthFlowContext)
  return (
    <a
      {...props}
      onClick={(event) => {
        onClick?.(event)
        if (
          !flow ||
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          props.target === '_blank' ||
          !props.href
        )
          return
        event.preventDefault()
        flow.push(props.href)
      }}
    />
  )
}

/** Routes are derived once from the configured mount; destination stays opaque and local-safe. */
export function authRoute(
  base: string,
  slug: string,
  params: Record<string, string | number | undefined> = {},
  destination?: string,
): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params))
    if (value !== undefined) query.set(key, String(value))
  if (destination !== undefined && safeAuthRedirect(destination) !== '/')
    query.set('redirect', safeAuthRedirect(destination))
  return `${base.replace(/\/$/, '')}/${slug}${query.size ? `?${query}` : ''}`
}
