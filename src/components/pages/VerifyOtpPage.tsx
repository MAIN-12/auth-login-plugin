'use client'

import { pluginConfig } from '../../config'
import VerifyOtpPageTailwind from './VerifyOtpPageTailwind'
import VerifyOtpPageHero from './VerifyOtpPageHero'
import type { AuthLayoutConfig } from '../AuthLayout'

export interface VerifyOtpPageProps extends AuthLayoutConfig { loginUrl?: string }

export default function VerifyOtpPage(props: VerifyOtpPageProps) {
  return pluginConfig.style === 'hero-ui' ? <VerifyOtpPageHero {...props} /> : <VerifyOtpPageTailwind {...props} />
}