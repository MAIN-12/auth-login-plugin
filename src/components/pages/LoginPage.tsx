'use client'

import { pluginConfig } from '../../config.js'
import LoginPageTailwind from './LoginPageTailwind.js'
import LoginPageHero from './LoginPageHero.js'
import type { AuthLayoutConfig } from '../AuthLayout.js'

export interface LoginPageProps extends AuthLayoutConfig {
  onPasswordLogin: (credentials: { email: string; password: string }) => Promise<void>
  redirectTo?: string
  showGoogleOAuth?: boolean
  signupUrl?: string
}

export default function LoginPage(props: LoginPageProps) {
  return pluginConfig.style === 'hero-ui' ? <LoginPageHero {...props} /> : <LoginPageTailwind {...props} />
}