'use client'

import { pluginConfig } from '../../config.js'
import ForgotPasswordPageTailwind from './ForgotPasswordPageTailwind.js'
import ForgotPasswordPageHero from './ForgotPasswordPageHero.js'
import type { AuthLayoutConfig } from '../AuthLayout.js'

export interface ForgotPasswordPageProps extends AuthLayoutConfig { loginUrl?: string }

export default function ForgotPasswordPage(props: ForgotPasswordPageProps) {
  return pluginConfig.style === 'hero-ui' ? <ForgotPasswordPageHero {...props} /> : <ForgotPasswordPageTailwind {...props} />
}