import React from 'react'
import type { PublicAuthConfig } from '../../auth/contracts/publicConfig'
import type { ResolvedAuthPresentation } from './types'
export async function getServerPresentationDefaults(
  settings: PublicAuthConfig,
): Promise<ResolvedAuthPresentation> {
  return {
    style: settings.style,
    locale: settings.locale ?? 'en',
    logo: settings.logoUrl ? (
      <img src={settings.logoUrl} alt="" width={180} height={42} className="object-contain" />
    ) : undefined,
  }
}
