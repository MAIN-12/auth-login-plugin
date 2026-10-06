'use client'

import React, { useState } from 'react'
import { useAllowSignup } from '../AuthSignupConfig'
import { createAuthService } from '../../auth/application/services/authService'
import { useAuthConfig } from '../AuthConfigContext'
import { useAuthPresentation } from '../auth-presentation/AuthPresentationContext'
import { getUiTranslations, type DeepPartial, type UiTranslations } from '../ui/translations'
import { AUTH_FORMS, type AuthFormSlug } from '../forms/index'
import { FORM_CONFIGS, type FormPropsContext } from './formConfigs'
import { AuthCardShell, type PoweredByConfig } from './AuthCardShell'

export interface FormRendererProps {
  slug: string | string[]
  redirectTo?: string
  onPasswordLogin?: (credentials: { email: string; password: string }) => Promise<void>
  onSignup?: (data: { name: string; email: string }) => Promise<void>
  basePath?: string
  showGoogleOAuth?: boolean
  passwordLogin?: boolean
  otpLogin?: boolean
  locale?: string
  messages?: Record<string, DeepPartial<UiTranslations>>
  logo?: React.ReactNode
  title?: string
  subtitle?: string
  footer?: React.ReactNode
  poweredBy?: PoweredByConfig
  cardClassName?: string
  removeBorder?: boolean
  removeShadow?: boolean
  mobileVariant?: 'plain' | 'card' | 'modal'
}

export function FormRenderer({
  slug,
  redirectTo = '/admin',
  onPasswordLogin,
  onSignup,
  basePath = '/auth',
  showGoogleOAuth,
  locale,
  messages,
  logo,
  title: titleOverride,
  subtitle: subtitleOverride,
  footer,
  poweredBy,
  cardClassName,
  removeBorder,
  removeShadow,
  mobileVariant,
}: FormRendererProps) {
  const allowSignup = useAllowSignup()
  const pluginConfig = useAuthConfig()
  const passwordHandler = onPasswordLogin ?? createAuthService(pluginConfig).login
  const signupHandler = onSignup ?? (async () => { throw new Error('Signup unavailable') })

  const presentation = useAuthPresentation({ locale, messages })
  const resolvedLocale = presentation.locale
  const t = getUiTranslations(resolvedLocale, presentation.messages)
  const normalizedSlug = (Array.isArray(slug) ? slug[0] : slug) as AuthFormSlug
  const base = basePath.replace(/\/$/, '')

  const [dynamicTitle, setDynamicTitle] = useState<string | undefined>(undefined)
  const [dynamicSubtitle, setDynamicSubtitle] = useState<string | undefined>(undefined)

  const effectiveSlug: AuthFormSlug =
    (normalizedSlug === 'signup' && !allowSignup) || (normalizedSlug === 'forgot-password' && !pluginConfig.recovery) || ((normalizedSlug === 'verify-otp' || normalizedSlug === 'set-password') && !pluginConfig.otpLogin && !pluginConfig.recovery) ? 'login' :
    (normalizedSlug in AUTH_FORMS ? normalizedSlug : 'login')

  const config = FORM_CONFIGS[effectiveSlug]
  const FormComponent = AUTH_FORMS[effectiveSlug] as React.ComponentType<any>

  const propsContext: FormPropsContext = {
    redirectTo,
    onPasswordLogin: passwordHandler,
    onSignup: signupHandler,
    basePath: base,
    showGoogleOAuth: pluginConfig.googleOAuthEnabled && (showGoogleOAuth ?? true),
    allowSignup,
    locale: resolvedLocale,
    messages: presentation.messages,
    setDynamicTitle,
    setDynamicSubtitle,
  }

  const translationSection = t[config.translationKey] as { title: string; subtitle: string }
  const title = titleOverride ?? dynamicTitle ?? translationSection.title
  const subtitle = subtitleOverride ?? dynamicSubtitle ?? translationSection.subtitle

  const formProps = config.getProps(propsContext)

  return (
    <AuthCardShell
      logo={logo}
      title={title}
      subtitle={subtitle}
      footer={footer}
      poweredBy={poweredBy}
      cardClassName={cardClassName}
      removeBorder={removeBorder}
      removeShadow={removeShadow}
      mobileVariant={mobileVariant}
    >
      <FormComponent {...formProps} />
    </AuthCardShell>
  )
}
