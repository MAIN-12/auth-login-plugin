'use client'

import { pluginConfig } from '../../config'
import LoginPageTailwind from './LoginPageTailwind'
import LoginPageHero from './LoginPageHero'
import type { AuthLayoutConfig } from '../AuthLayout'

export interface LoginPageProps extends AuthLayoutConfig {
  onPasswordLogin: (credentials: { email: string; password: string }) => Promise<void>
  redirectTo?: string
  showGoogleOAuth?: boolean
  signupUrl?: string
}

export default function LoginPage(props: LoginPageProps) {
  const resolved = { showGoogleOAuth: pluginConfig.googleOAuthEnabled, ...props }
  return pluginConfig.style === 'hero-ui' ? <LoginPageHero {...resolved} /> : <LoginPageTailwind {...resolved} />
}