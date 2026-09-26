'use client'

import React from 'react'
import { Button, Input } from '../ui/index'
import { useSetPasswordFlow } from '../../auth/application/hooks/useSetPasswordFlow'
import { getUiTranslations, type DeepPartial, type UiTranslations } from '../ui/translations'

export interface SetPasswordFormProps {
  redirectTo?: string
  locale?: string
  messages?: Record<string, DeepPartial<UiTranslations>>
}

export function SetPasswordForm({
  redirectTo = '/',
  locale,
  messages,
}: SetPasswordFormProps) {
  const {
    password, confirmPassword, error, isLoading, showPassword, strength,
    setPassword, setConfirmPassword, setShowPassword, handleSubmit,
  } = useSetPasswordFlow({ redirectTo })

  const strengthBars = Array.from({ length: 5 }, (_, i) => i < strength.score)
  const translations = getUiTranslations(locale, messages)
  const t = translations.setPassword
  const errors = translations.errors

  // Helper to translate error keys
  const getErrorMessage = (err: string | null): string | null => {
    if (!err) return null
    if (err in errors) return errors[err as keyof typeof errors]
    return err
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="bg-red-50 text-red-600 border border-red-200 rounded-lg p-3 text-sm animate-[fadeIn_0.2s_ease-out]">{getErrorMessage(error)}</div>}

      <div className="relative">
        <Input type={showPassword ? 'text' : 'password'} label={t.newPasswordLabel} value={password} onValueChange={setPassword} isRequired autoFocus />
        <button type="button" onClick={() => setShowPassword(!showPassword)}
          className="absolute right-4 top-9 text-gray-400 hover:text-gray-600">
          {showPassword ? '🙈' : '👁'}
        </button>
      </div>

      {password.length > 0 && (
        <div className="flex gap-1">
          {strengthBars.map((active, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${active ? 'bg-[#D5E855]' : 'bg-gray-200'}`} />
          ))}
        </div>
      )}
      {password.length > 0 && !strength.isValid && (
        <p className="text-xs text-gray-500">{t.passwordRequirements}</p>
      )}

      <Input type={showPassword ? 'text' : 'password'} label={t.confirmPasswordLabel} value={confirmPassword} onValueChange={setConfirmPassword} isRequired />
      <Button type="submit" variant="primary" isLoading={isLoading}>{t.setPassword}</Button>
    </form>
  )
}
