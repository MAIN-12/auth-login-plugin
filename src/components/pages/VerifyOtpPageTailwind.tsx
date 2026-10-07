'use client'
import React from 'react'
import { VerifyOtpForm } from '../forms/VerifyOtpForm'
import { useAuthTranslations } from '../auth-presentation/AuthPresentationContext'
import { AuthLayout } from '../AuthLayout'
import { AuthCard } from '../AuthCard'
import type { VerifyOtpPageProps } from './VerifyOtpPage'
export default function VerifyOtpPage({
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
}: VerifyOtpPageProps) {
  const t = useAuthTranslations(locale, messages).verifyOtp
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
        <VerifyOtpForm loginUrl={loginUrl} locale={locale} messages={messages} />
      </AuthCard>
    </AuthLayout>
  )
}
