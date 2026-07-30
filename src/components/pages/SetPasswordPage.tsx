'use client'

import { pluginConfig } from '../../config.js'
import SetPasswordPageTailwind from './SetPasswordPageTailwind.js'
import SetPasswordPageHero from './SetPasswordPageHero.js'
import type { AuthLayoutConfig } from '../AuthLayout.js'

export interface SetPasswordPageProps extends AuthLayoutConfig { redirectTo?: string }

export default function SetPasswordPage(props: SetPasswordPageProps) {
  return pluginConfig.style === 'hero-ui' ? <SetPasswordPageHero {...props} /> : <SetPasswordPageTailwind {...props} />
}