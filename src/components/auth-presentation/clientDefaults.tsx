import React from 'react'
import { pluginConfig } from '../../config'
import { detectClientLocale } from '../ui/locale'
import type { ResolvedAuthPresentation } from './types'

/** Legacy client configuration adapter; reads defaults without mutating them. */
export function getClientPresentationDefaults(): ResolvedAuthPresentation {
  const Logo = pluginConfig.Logo
  return {
    style: pluginConfig.style,
    locale: detectClientLocale(),
    logo: Logo ? <Logo /> : pluginConfig.logoUrl
      ? <img src={pluginConfig.logoUrl} alt="" width={180} height={42} className="object-contain" />
      : undefined,
  }
}
