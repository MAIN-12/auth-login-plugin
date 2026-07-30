'use client'

import { pluginConfig } from '../../config'
import ForgotPasswordPageTailwind from './ForgotPasswordPageTailwind'
import ForgotPasswordPageHero from './ForgotPasswordPageHero'
import type { AuthLayoutConfig } from '../AuthLayout'

export interface ForgotPasswordPageProps extends AuthLayoutConfig { loginUrl?: string }

export default function ForgotPasswordPage(props: ForgotPasswordPageProps) {
  return pluginConfig.style === 'hero-ui' ? <ForgotPasswordPageHero {...props} /> : <ForgotPasswordPageTailwind {...props} />
}