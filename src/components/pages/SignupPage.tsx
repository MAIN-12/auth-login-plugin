'use client'

import { pluginConfig } from '../../config.js'
import SignupPageTailwind from './SignupPageTailwind.js'
import SignupPageHero from './SignupPageHero.js'
import type { AuthLayoutConfig } from '../AuthLayout.js'

export interface SignupPageProps extends AuthLayoutConfig {
  onSignup: (data: { name: string; email: string }) => Promise<void>
  showGoogleOAuth?: boolean
  loginUrl?: string
}

export default function SignupPage(props: SignupPageProps) {
  const resolved = { showGoogleOAuth: pluginConfig.googleOAuthEnabled, ...props }
  return pluginConfig.style === 'hero-ui' ? <SignupPageHero {...resolved} /> : <SignupPageTailwind {...resolved} />
}