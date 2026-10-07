'use client'

import { useAuthTranslations } from '../auth-presentation/AuthPresentationContext'

import { authErrorMessage } from '../ui/translations'
import React from 'react'
import { useAuthConfig } from '../AuthConfigContext'
import { AuthLink, useAuthSearchParams, authRoute } from '../../auth/application/AuthFlowContext'
import { Button, Input } from '../ui/index'
import { useSetPasswordFlow } from '../../auth/application/hooks/useSetPasswordFlow'
import type { AuthLocalizationProps } from '../auth-presentation/types'

export interface SetPasswordFormProps extends AuthLocalizationProps {
  redirectTo?: string
}

export function SetPasswordForm({
  redirectTo = '/',
  locale,
  messages,
}: SetPasswordFormProps) {
  const {
    password, confirmPassword, currentPassword, requiresReauthentication, error, isLoading, showPassword, strength,
    setPassword, setConfirmPassword, setCurrentPassword, setShowPassword, handleSubmit, handleReauthenticate, handleOtpReauthenticate,
  } = useSetPasswordFlow({ redirectTo, locale })

  const config = useAuthConfig()
  const params = useAuthSearchParams()
  const destination = params.get('redirect') ?? redirectTo
  const strengthBars = Array.from({ length: 5 }, (_, i) => i < strength.score)
  const translations = useAuthTranslations(locale, messages)
  const t = translations.setPassword

  // Helper to translate error keys
  const getErrorMessage = (error: string | null) => authErrorMessage(error, translations)

  if (requiresReauthentication) return (
    <div className="space-y-4">
      <h2>{t.setPassword}</h2>
      <p>{t.reauthenticationIntro}</p>
      {error && <p role="alert">{getErrorMessage(error)}</p>}
      <Input type="password" autoComplete="current-password" error={getErrorMessage(error)} label={t.currentPasswordLabel} value={currentPassword} onValueChange={setCurrentPassword} />
      <Button variant="primary" isLoading={isLoading} onPress={handleReauthenticate}>{t.reauthenticate}</Button>
      {config.otpLogin && <Button variant="bordered" isLoading={isLoading} onPress={handleOtpReauthenticate}>{t.verifyByEmail}</Button>}
      <AuthLink href={authRoute(config.authBasePath, 'login', {}, destination)}>{t.backToLogin}</AuthLink>
    </div>
  )
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div role="alert" className="bg-red-50 text-red-700 border border-red-200 rounded-lg p-3 text-sm animate-[fadeIn_0.2s_ease-out]">{getErrorMessage(error)}</div>}

      <div className="relative">
        <Input type={showPassword ? 'text' : 'password'} error={getErrorMessage(error)} label={t.newPasswordLabel} value={password} onValueChange={setPassword} isRequired autoFocus autoComplete="new-password" />
        <button type="button" aria-label={showPassword ? t.hidePassword : t.showPassword} onClick={() => setShowPassword(!showPassword)}
          style={{ width: 40, height: 40 }}
          className="absolute right-2 top-7 flex items-center justify-center rounded-md text-gray-600 hover:text-gray-900 focus-visible:outline-2">
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

      <Input type={showPassword ? 'text' : 'password'} error={getErrorMessage(error)} label={t.confirmPasswordLabel} value={confirmPassword} onValueChange={setConfirmPassword} isRequired autoComplete="new-password" />
      <Button type="submit" variant="primary" isLoading={isLoading}>{t.setPassword}</Button>
    </form>
  )
}
