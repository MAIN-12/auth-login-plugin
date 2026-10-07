'use client'

import { useAuthPresentation } from '../auth-presentation/AuthPresentationContext'

import ForgotPasswordPageTailwind from './ForgotPasswordPageTailwind'
import ForgotPasswordPageHero from './ForgotPasswordPageHero'
import type { AuthLayoutConfig } from '../AuthLayout'
import type { AuthCardConfig } from '../AuthCard'

export interface ForgotPasswordPageProps extends AuthLayoutConfig, AuthCardConfig {
  loginUrl?: string
}

export default function ForgotPasswordPage(props: ForgotPasswordPageProps) {
  const { style } = useAuthPresentation(props)
  return style === 'hero-ui' ? (
    <ForgotPasswordPageHero {...props} />
  ) : (
    <ForgotPasswordPageTailwind {...props} />
  )
}
