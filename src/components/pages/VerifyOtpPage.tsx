'use client'

import { pluginConfig } from '../../config.js'
import VerifyOtpPageTailwind from './VerifyOtpPageTailwind.js'
import VerifyOtpPageHero from './VerifyOtpPageHero.js'
import type { AuthLayoutConfig } from '../AuthLayout.js'

export interface VerifyOtpPageProps extends AuthLayoutConfig { loginUrl?: string }

export default function VerifyOtpPage(props: VerifyOtpPageProps) {
  return pluginConfig.style === 'hero-ui' ? <VerifyOtpPageHero {...props} /> : <VerifyOtpPageTailwind {...props} />
}