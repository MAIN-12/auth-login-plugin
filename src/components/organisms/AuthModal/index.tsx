'use client'

import { withAuthStyle } from '../../../hoc/withAuthStyle'
import type { AuthModalProps } from './types'
import { NativeAuthModal } from './NativeAuthModal'
export type { AuthModalProps } from './types'

export const AuthModal = withAuthStyle<AuthModalProps>(
  NativeAuthModal,
  () => import('./AuthModalHero'),
  { fallback: 'none' },
)
