'use client'

import React, { useState } from 'react'
import { useAllowSignup } from '../AuthSignupConfig'
import { useAuthService } from '../../auth/interface/react/AuthServiceContext'
import { useAuthConfig, AuthConfigProvider } from '../AuthConfigContext'
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
  basePath,
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
  const signupHandler =
    onSignup ??
    (async () => {
      throw new Error('Signup unavailable')
    })

  const presentation = useAuthPresentation({ locale, messages })
  const resolvedLocale = presentation.locale
  const service = useAuthService(resolvedLocale)
  const passwordHandler = onPasswordLogin ?? service.login
  const t = getUiTranslations(resolvedLocale, presentation.messages)
  const normalizedSlug = (Array.isArray(slug) ? slug[0] : slug) as AuthFormSlug
  const base = (basePath ?? pluginConfig.authBasePath).replace(/\/$/, '')

  const [dynamicTitle, setDynamicTitle] = useState<string | undefined>(undefined)
  const [dynamicSubtitle, setDynamicSubtitle] = useState<string | undefined>(undefined)

  const effectiveSlug: AuthFormSlug =
    (normalizedSlug === 'signup' && (!allowSignup || !pluginConfig.passwordLogin)) ||
    (normalizedSlug === 'forgot-password' && !pluginConfig.recovery) ||
    ((normalizedSlug === 'verify-otp' || normalizedSlug === 'set-password') &&
      !pluginConfig.passwordLogin &&
      !pluginConfig.otpLogin &&
      !pluginConfig.recovery &&
      !pluginConfig.allowSignup)
      ? 'login'
      : Object.hasOwn(AUTH_FORMS, normalizedSlug)
        ? normalizedSlug
        : 'login'

  const config = FORM_CONFIGS[effectiveSlug]

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

  const form =
    effectiveSlug === 'login' ? (
      <AUTH_FORMS.login {...FORM_CONFIGS.login.getProps(propsContext)} />
    ) : effectiveSlug === 'signup' ? (
      <AUTH_FORMS.signup {...FORM_CONFIGS.signup.getProps(propsContext)} />
    ) : effectiveSlug === 'forgot-password' ? (
      React.createElement(
        AUTH_FORMS['forgot-password'],
        FORM_CONFIGS['forgot-password'].getProps(propsContext),
      )
    ) : effectiveSlug === 'verify-otp' ? (
      React.createElement(
        AUTH_FORMS['verify-otp'],
        FORM_CONFIGS['verify-otp'].getProps(propsContext),
      )
    ) : (
      React.createElement(
        AUTH_FORMS['set-password'],
        FORM_CONFIGS['set-password'].getProps(propsContext),
      )
    )

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
      <AuthConfigProvider publicConfig={Object.freeze({ ...pluginConfig, authBasePath: base })}>
        {form}
      </AuthConfigProvider>
    </AuthCardShell>
  )
}
