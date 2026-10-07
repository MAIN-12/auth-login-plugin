'use client'

import { useAuthPresentation } from '../auth-presentation/AuthPresentationContext'

import VerifyOtpPageTailwind from './VerifyOtpPageTailwind'
import VerifyOtpPageHero from './VerifyOtpPageHero'
import type { AuthLayoutConfig } from '../AuthLayout'
import type { AuthCardConfig } from '../AuthCard'

export interface VerifyOtpPageProps extends AuthLayoutConfig, AuthCardConfig {
  loginUrl?: string
}

export default function VerifyOtpPage(props: VerifyOtpPageProps) {
  const { style } = useAuthPresentation(props)
  return style === 'hero-ui' ? (
    <VerifyOtpPageHero {...props} />
  ) : (
    <VerifyOtpPageTailwind {...props} />
  )
}
