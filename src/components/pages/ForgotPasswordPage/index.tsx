'use client'
import React from 'react'
import { ForgotPasswordForm } from '../../organisms/ForgotPasswordForm'
import { useAuthTranslations } from '../../../contexts/AuthAppearanceContext'
import { AuthLayout } from '../../templates/AuthLayout'
import { AuthCard } from '../../organisms/AuthCard'
import type { AuthLayoutConfig } from '../../templates/AuthLayout'
import type { AuthCardConfig } from '../../organisms/AuthCard'

export interface ForgotPasswordPageProps extends AuthLayoutConfig, AuthCardConfig {
  loginUrl?: string
}
export default function ForgotPasswordPage(props: ForgotPasswordPageProps) {
  const {
    loginUrl,
    style,
    logo,
    poweredBy,
    cardClassName,
    removeBorder,
    removeShadow,
    mobileVariant,
    backgroundClass,
    texture,
    locale,
    messages,
  } = props
  const t = useAuthTranslations(locale, messages).forgotPassword
  return (
    <AuthLayout backgroundClass={backgroundClass} texture={texture}>
      <AuthCard
        style={style}
        logo={logo}
        title={t.title}
        subtitle={t.subtitle}
        poweredBy={poweredBy}
        cardClassName={cardClassName}
        removeBorder={removeBorder}
        removeShadow={removeShadow}
        mobileVariant={mobileVariant}
      >
        <ForgotPasswordForm loginUrl={loginUrl} locale={locale} messages={messages} />
      </AuthCard>
    </AuthLayout>
  )
}
