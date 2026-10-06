import React from 'react'
import { headers } from 'next/headers'
import type { PublicAuthConfig } from '../../config'
import { detectServerLocale } from '../ui/locale'
import type { ResolvedAuthPresentation } from './types'
export async function getServerPresentationDefaults(settings: PublicAuthConfig): Promise<ResolvedAuthPresentation> {
  return { style: settings.style, locale: detectServerLocale(await headers()),
    logo: settings.logoUrl ? <img src={settings.logoUrl} alt="" width={180} height={42} className="object-contain" /> : undefined }
}
