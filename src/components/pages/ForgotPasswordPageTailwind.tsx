'use client'

import { useAuthTranslations } from '../auth-presentation/AuthPresentationContext'

import React from 'react'
import { Button, Input } from '../ui/index'
import { useForgotPasswordFlow } from '../../auth/application/hooks/useForgotPasswordFlow'
import { AuthLayout } from '../AuthLayout'
import type { AuthLayoutConfig } from '../AuthLayout'
import { AuthCard } from '../AuthCard'
import type { AuthCardConfig } from '../AuthCard'

export interface ForgotPasswordPageProps extends AuthLayoutConfig, AuthCardConfig {
  loginUrl?: string
}

export default function ForgotPasswordPage({
  loginUrl = '/login',
  logo, poweredBy, cardClassName, removeBorder, removeShadow, mobileVariant, backgroundClass, texture, locale, messages,
}: ForgotPasswordPageProps) {
  const { email, error, isLoading, setEmail, handleSubmit } = useForgotPasswordFlow()
  const t = useAuthTranslations(locale, messages).forgotPassword

  return (
    <AuthLayout backgroundClass={backgroundClass} texture={texture}>
    <AuthCard
      logo={logo} title={t.title} subtitle={t.subtitle}
      poweredBy={poweredBy} cardClassName={cardClassName} removeBorder={removeBorder} removeShadow={removeShadow} mobileVariant={mobileVariant}
      footer={
        <a href={loginUrl} className="text-sm text-gray-600 hover:text-gray-900 inline-flex items-center gap-1">
          ← {t.backToLogin}
        </a>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 text-red-600 border border-red-200 rounded-lg p-3 text-sm animate-[fadeIn_0.2s_ease-out]">{error}</div>}
        <Input type="email" label={t.emailLabel} value={email} onChange={e => setEmail(e.target.value)} isRequired />
        <Button type="submit" variant="primary" isLoading={isLoading}>{t.sendResetCode}</Button>
      </form>
    </AuthCard>
    </AuthLayout>
  )
}