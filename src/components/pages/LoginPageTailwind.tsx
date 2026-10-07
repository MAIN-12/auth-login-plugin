'use client'
import React from 'react'
import { LoginForm } from '../forms/LoginForm'
import { useAuthTranslations } from '../auth-presentation/AuthPresentationContext'
import { AuthLayout } from '../AuthLayout'
import { AuthCard } from '../AuthCard'
import type { LoginPageProps } from './LoginPage'
export default function LoginPage({ onPasswordLogin, redirectTo, showGoogleOAuth, signupUrl, style, logo, poweredBy, cardClassName, removeBorder, removeShadow, mobileVariant, backgroundClass, texture, locale, messages }: LoginPageProps) {
  const t = useAuthTranslations(locale, messages).login
  return <AuthLayout backgroundClass={backgroundClass} texture={texture}><AuthCard style={style} logo={logo} title={t.title} subtitle={t.subtitle} poweredBy={poweredBy} cardClassName={cardClassName} removeBorder={removeBorder} removeShadow={removeShadow} mobileVariant={mobileVariant}><LoginForm onPasswordLogin={onPasswordLogin} redirectTo={redirectTo} showGoogleOAuth={showGoogleOAuth} signupUrl={signupUrl} locale={locale} messages={messages} /></AuthCard></AuthLayout>
}
