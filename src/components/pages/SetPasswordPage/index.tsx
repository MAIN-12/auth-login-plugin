'use client'
import React from 'react'
import { SetPasswordForm } from '../../organisms/SetPasswordForm'
import { useAuthTranslations } from '../../../contexts/AuthAppearanceContext'
import { AuthLayout, type AuthLayoutConfig } from '../../templates/AuthLayout'
import { AuthCard, type AuthCardConfig } from '../../organisms/AuthCard'
export interface SetPasswordPageProps extends AuthLayoutConfig, AuthCardConfig {
  redirectTo?: string
}
export default function SetPasswordPage(props: SetPasswordPageProps) {
  const {
    redirectTo,
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
  const t = useAuthTranslations(locale, messages).setPassword
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
        <SetPasswordForm redirectTo={redirectTo} locale={locale} messages={messages} />
      </AuthCard>
    </AuthLayout>
  )
}
