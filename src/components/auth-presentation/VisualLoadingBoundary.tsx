'use client'

import React, { createContext, Suspense, useContext } from 'react'
import { AuthLoadingIndicator } from '../atoms/AuthLoadingIndicator'

/** Presentation handshake only; AuthCard owns the enclosing suspense/reveal. */
export const AuthCardLoadingContext = createContext(false)

export function VisualLoadingBoundary({ children }: { children: React.ReactNode }) {
  const insideCard = useContext(AuthCardLoadingContext)
  return insideCard ? children : <Suspense fallback={<AuthLoadingIndicator />}>{children}</Suspense>
}
