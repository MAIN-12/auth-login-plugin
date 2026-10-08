'use client'

import React, { lazy, Suspense } from 'react'
import type { AuthStyle } from '../../../auth/contracts/publicConfig'
import type { AuthModalProps } from './types'
import { NativeAuthModal } from './NativeAuthModal'
export type { AuthModalProps } from './types'

const HeroAuthModal = lazy(() => import('./AuthModalHero'))

export function AuthModal({ style, ...props }: AuthModalProps & { style: AuthStyle }) {
  return style === 'hero-ui' ? (
    <Suspense fallback={null}>
      <HeroAuthModal {...props} />
    </Suspense>
  ) : (
    <NativeAuthModal {...props} />
  )
}
