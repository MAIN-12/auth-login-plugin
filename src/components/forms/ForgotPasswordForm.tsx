'use client'

import React from 'react'
import { Button, Input } from '../ui/index'
import { useForgotPasswordFlow } from '../../auth/application/hooks/useForgotPasswordFlow'
import { getUiTranslations, type DeepPartial, type UiTranslations } from '../ui/translations'

export interface ForgotPasswordFormProps {
  loginUrl?: string
  locale?: string
  messages?: Record<string, DeepPartial<UiTranslations>>
}

export function ForgotPasswordForm({
  loginUrl = '/login',
  locale,
  messages,
}: ForgotPasswordFormProps) {
  const { email, error, isLoading, setEmail, handleSubmit } = useForgotPasswordFlow()
  const translations = getUiTranslations(locale, messages)
  const t = translations.forgotPassword
  const errors = translations.errors

  // Helper to translate error keys
  const getErrorMessage = (err: string | null): string | null => {
    if (!err) return null
    if (err in errors) return errors[err as keyof typeof errors]
    return err
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 text-red-600 border border-red-200 rounded-lg p-3 text-sm animate-[fadeIn_0.2s_ease-out]">{getErrorMessage(error)}</div>}
        <Input type="email" label={t.emailLabel} value={email} onChange={e => setEmail(e.target.value)} isRequired />
        <Button type="submit" variant="primary" isLoading={isLoading}>{t.sendResetCode}</Button>
      </form>
      <div className="text-center mt-6">
        <a href={loginUrl} className="text-sm text-gray-600 hover:text-gray-900 inline-flex items-center gap-1">
          ← {t.backToLogin}
        </a>
      </div>
    </>
  )
}
