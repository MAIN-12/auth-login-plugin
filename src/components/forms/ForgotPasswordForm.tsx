'use client'

import { useAuthTranslations } from '../auth-presentation/AuthPresentationContext'

import { authErrorMessage } from '../ui/translations'
import React from 'react'
import { useAuthConfig } from '../AuthConfigContext'
import { AuthLink, useAuthSearchParams, authRoute } from '../../auth/application/AuthFlowContext'
import { Button, Input } from '../ui/index'
import { useForgotPasswordFlow } from '../../auth/application/hooks/useForgotPasswordFlow'
import type { AuthLocalizationProps } from '../auth-presentation/types'

export interface ForgotPasswordFormProps extends AuthLocalizationProps {
  loginUrl?: string
}

export function ForgotPasswordForm({
  loginUrl,
  locale,
  messages,
}: ForgotPasswordFormProps) {
  const config = useAuthConfig()
  const params = useAuthSearchParams()
  const { email, error, isLoading, setEmail, handleSubmit } = useForgotPasswordFlow(locale)
  const translations = useAuthTranslations(locale, messages)
  const t = translations.forgotPassword

  // Helper to translate error keys
  const getErrorMessage = (error: string | null) => authErrorMessage(error, translations)

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div role="alert" className="bg-red-50 text-red-700 border border-red-200 rounded-lg p-3 text-sm animate-[fadeIn_0.2s_ease-out]">{getErrorMessage(error)}</div>}
        <Input type="email" error={getErrorMessage(error)} label={t.emailLabel} value={email} onChange={e => setEmail(e.target.value)} isRequired />
        <Button type="submit" variant="primary" isLoading={isLoading}>{t.sendResetCode}</Button>
      </form>
      <div className="text-center mt-6">
        <AuthLink href={loginUrl ?? authRoute(config.authBasePath, 'login', {}, params.get('redirect') ?? '/')} className="text-sm text-gray-600 hover:text-gray-900 inline-flex items-center gap-1">
          ← {t.backToLogin}
        </AuthLink>
      </div>
    </>
  )
}
