'use client'

import { AuthConfigContext } from '../AuthConfigContext'
import type { PublicAuthConfig } from '../../auth/contracts/publicConfig'
import React, { createContext, useContext, useMemo } from 'react'
import { AuthLogo } from '../../components/atoms/AuthLogo'
import { getUiTranslations } from '../../i18n/ui'
import { getAuthAppearanceDefaults } from '../../configuration/authAppearance/defaults'
import { mergeAuthPresentation } from '../../configuration/authAppearance/resolveAppearance'
import type {
  AuthLocalizationProps,
  AuthPresentationProps,
  ResolvedAuthPresentation,
} from '../../configuration/authAppearance/types'

export const AuthPresentationContext = createContext<AuthPresentationProps | undefined>(undefined)

/** UI adapter; safe to use without a session provider, including custom forms. */
export function useAuthPresentation(
  overrides?: AuthPresentationProps,
  defaults?: PublicAuthConfig,
): ResolvedAuthPresentation {
  const inherited = useContext(AuthPresentationContext)
  const config = useContext(AuthConfigContext)
  const { logoUrl, ...appearance } = getAuthAppearanceDefaults(defaults ?? config)
  return mergeAuthPresentation(
    { ...appearance, logo: logoUrl ? <AuthLogo src={logoUrl} /> : undefined },
    inherited,
    overrides,
  ) as ResolvedAuthPresentation
}

/** Server defaults must never masquerade as explicit component overrides. */
export function AuthPresentationDefaults({
  value,
  children,
}: {
  value: AuthPresentationProps
  children: React.ReactNode
}) {
  const inherited = useContext(AuthPresentationContext)
  const settings = useMemo(() => mergeAuthPresentation(value, inherited), [value, inherited])
  return (
    <AuthPresentationContext.Provider value={settings}>{children}</AuthPresentationContext.Provider>
  )
}

export function useAuthTranslations(
  locale?: AuthLocalizationProps['locale'],
  messages?: AuthLocalizationProps['messages'],
) {
  const settings = useAuthPresentation({ locale, messages })
  return getUiTranslations(settings.locale, settings.messages)
}
