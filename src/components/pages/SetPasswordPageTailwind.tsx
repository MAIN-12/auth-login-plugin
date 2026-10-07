'use client'
import React from 'react'
import { SetPasswordForm } from '../forms/SetPasswordForm'
import { useAuthTranslations } from '../auth-presentation/AuthPresentationContext'
import { AuthLayout, type AuthLayoutConfig } from '../AuthLayout'
import { AuthCard, type AuthCardConfig } from '../AuthCard'
export interface SetPasswordPageProps extends AuthLayoutConfig, AuthCardConfig { redirectTo?: string }
export default function SetPasswordPage({ redirectTo, style, logo, poweredBy, cardClassName, removeBorder, removeShadow, mobileVariant, backgroundClass, texture, locale, messages }: SetPasswordPageProps) {
  const t = useAuthTranslations(locale, messages).setPassword
  return <AuthLayout backgroundClass={backgroundClass} texture={texture}><AuthCard style={style} logo={logo} title={t.title} subtitle={t.subtitle} poweredBy={poweredBy} cardClassName={cardClassName} removeBorder={removeBorder} removeShadow={removeShadow} mobileVariant={mobileVariant}>
    <SetPasswordForm redirectTo={redirectTo} locale={locale} messages={messages} />
  </AuthCard></AuthLayout>
}
