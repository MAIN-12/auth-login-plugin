import React from 'react'
import { headers } from 'next/headers'
import { getServerProviderConfig, pluginConfig } from '../../config'
import { detectServerLocale } from '../ui/locale'
import type { ResolvedAuthPresentation } from './types'

/** Request adapter. Only server entry points import this module. */
export async function getServerPresentationDefaults(): Promise<ResolvedAuthPresentation> {
  const settings = getServerProviderConfig()
  const Logo = pluginConfig.Logo
  return {
    style: settings.style,
    locale: detectServerLocale(await headers()),
    logo: Logo ? <Logo /> : settings.logoUrl
      ? <img src={settings.logoUrl} alt="" width={180} height={42} className="object-contain" />
      : undefined,
  }
}
