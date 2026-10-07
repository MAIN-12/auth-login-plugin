'use client'
import React from 'react'
import { ForgotPasswordForm } from '../forms/ForgotPasswordForm'
import { useAuthTranslations } from '../auth-presentation/AuthPresentationContext'
import { AuthLayout } from '../AuthLayout'
import { AuthCard } from '../AuthCard'
import type { ForgotPasswordPageProps } from './ForgotPasswordPage'
export default function ForgotPasswordPage({ loginUrl, style, logo, poweredBy, cardClassName, removeBorder, removeShadow, mobileVariant, backgroundClass, texture, locale, messages }: ForgotPasswordPageProps) {
  const t = useAuthTranslations(locale, messages).forgotPassword
  return <AuthLayout backgroundClass={backgroundClass} texture={texture}><AuthCard style={style} logo={logo} title={t.title} subtitle={t.subtitle} poweredBy={poweredBy} cardClassName={cardClassName} removeBorder={removeBorder} removeShadow={removeShadow} mobileVariant={mobileVariant}><ForgotPasswordForm loginUrl={loginUrl} locale={locale} messages={messages} /></AuthCard></AuthLayout>
}
