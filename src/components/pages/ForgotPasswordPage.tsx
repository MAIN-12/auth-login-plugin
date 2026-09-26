'use client'

import { pluginConfig } from '../../config'
import ForgotPasswordPageTailwind from './ForgotPasswordPageTailwind'
import ForgotPasswordPageHero from './ForgotPasswordPageHero'
import type { AuthLayoutConfig } from '../AuthLayout'
import type { AuthCardConfig } from '../AuthCard'

export interface ForgotPasswordPageProps extends AuthLayoutConfig, AuthCardConfig { loginUrl?: string }

export default function ForgotPasswordPage(props: ForgotPasswordPageProps) {
  return pluginConfig.style === 'hero-ui' ? <ForgotPasswordPageHero {...props} /> : <ForgotPasswordPageTailwind {...props} />
}