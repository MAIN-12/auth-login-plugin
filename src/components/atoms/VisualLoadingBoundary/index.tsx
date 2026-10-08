'use client'

import React, { Suspense, useContext } from 'react'
import { AuthLoadingIndicator } from '../AuthLoadingIndicator'

import { AuthCardLoadingContext } from '../../../contexts/AuthCardLoadingContext'

export function VisualLoadingBoundary({ children }: { children: React.ReactNode }) {
  const insideCard = useContext(AuthCardLoadingContext)
  return insideCard ? children : <Suspense fallback={<AuthLoadingIndicator />}>{children}</Suspense>
}
