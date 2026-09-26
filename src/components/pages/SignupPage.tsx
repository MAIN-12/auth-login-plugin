'use client'

import { pluginConfig } from '../../config'
import SignupPageTailwind from './SignupPageTailwind'
import SignupPageHero from './SignupPageHero'
import type { AuthLayoutConfig } from '../AuthLayout'
import type { AuthCardConfig } from '../AuthCard'

export interface SignupPageProps extends AuthLayoutConfig, AuthCardConfig {
  onSignup: (data: { name: string; email: string }) => Promise<void>
  showGoogleOAuth?: boolean
  loginUrl?: string
}

export default function SignupPage(props: SignupPageProps) {
  const resolved = { showGoogleOAuth: pluginConfig.googleOAuthEnabled, ...props }
  return pluginConfig.style === 'hero-ui' ? <SignupPageHero {...resolved} /> : <SignupPageTailwind {...resolved} />
}