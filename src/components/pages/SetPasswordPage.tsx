'use client'

import { pluginConfig } from '../../config'
import SetPasswordPageTailwind from './SetPasswordPageTailwind'
import SetPasswordPageHero from './SetPasswordPageHero'
import type { AuthLayoutConfig } from '../AuthLayout'
import type { AuthCardConfig } from '../AuthCard'

export interface SetPasswordPageProps extends AuthLayoutConfig, AuthCardConfig { redirectTo?: string }

export default function SetPasswordPage(props: SetPasswordPageProps) {
  return pluginConfig.style === 'hero-ui' ? <SetPasswordPageHero {...props} /> : <SetPasswordPageTailwind {...props} />
}