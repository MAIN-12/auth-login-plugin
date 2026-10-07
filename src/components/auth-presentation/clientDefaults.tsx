import React from 'react'
import type { PublicAuthConfig } from '../../config'
import type { ResolvedAuthPresentation } from './types'
export function getClientPresentationDefaults(
  config?: PublicAuthConfig | null,
): ResolvedAuthPresentation {
  return {
    style: config?.style ?? 'tailwind',
    locale: config?.locale ?? 'en',
    logo: config?.logoUrl ? <img src={config.logoUrl} alt="" width={180} height={42} /> : undefined,
  }
}
