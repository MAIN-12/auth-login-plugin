'use client'

import { pluginConfig } from '../../config'
import SetPasswordPageTailwind from './SetPasswordPageTailwind'
import SetPasswordPageHero from './SetPasswordPageHero'
import type { AuthLayoutConfig } from '../AuthLayout'

export interface SetPasswordPageProps extends AuthLayoutConfig { redirectTo?: string }

export default function SetPasswordPage(props: SetPasswordPageProps) {
  return pluginConfig.style === 'hero-ui' ? <SetPasswordPageHero {...props} /> : <SetPasswordPageTailwind {...props} />
}