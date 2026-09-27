'use client'

import { useAuthPresentation } from '../auth-presentation/AuthPresentationContext'

import SetPasswordPageTailwind from './SetPasswordPageTailwind'
import SetPasswordPageHero from './SetPasswordPageHero'
import type { AuthLayoutConfig } from '../AuthLayout'
import type { AuthCardConfig } from '../AuthCard'

export interface SetPasswordPageProps extends AuthLayoutConfig, AuthCardConfig { redirectTo?: string }

export default function SetPasswordPage(props: SetPasswordPageProps) {
  const { style } = useAuthPresentation(props)
  return style === 'hero-ui' ? <SetPasswordPageHero {...props} /> : <SetPasswordPageTailwind {...props} />
}