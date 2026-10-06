'use client'

import { useAuthPresentation } from '../auth-presentation/AuthPresentationContext'

import { useAuthConfig } from '../AuthConfigContext'
import LoginPageTailwind from './LoginPageTailwind'
import LoginPageHero from './LoginPageHero'
import type { AuthLayoutConfig } from '../AuthLayout'
import type { AuthCardConfig } from '../AuthCard'

export interface LoginPageProps extends AuthLayoutConfig, AuthCardConfig {
  onPasswordLogin: (credentials: { email: string; password: string }) => Promise<void>
  redirectTo?: string
  showGoogleOAuth?: boolean
  signupUrl?: string
}

export default function LoginPage(props: LoginPageProps) {
  const pluginConfig = useAuthConfig()
  const resolved = { showGoogleOAuth: pluginConfig.googleOAuthEnabled, ...props }
  const { style } = useAuthPresentation(props)
  return style === 'hero-ui' ? <LoginPageHero {...resolved} /> : <LoginPageTailwind {...resolved} />
}