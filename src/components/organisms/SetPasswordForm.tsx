'use client'

import { useAuthTranslations } from '../auth-presentation/AuthPresentationContext'

import { useAuthThemeClasses } from '../ui/theme'
import { authErrorMessage } from '../ui/translations'
import React from 'react'
import { useAuthConfig } from '../AuthConfigContext'
import {
  AuthLink,
  useAuthSearchParams,
  authRoute,
} from '../../auth/interface/react/AuthFlowContext'
import { Button } from '../atoms'
import { PasswordField } from '../molecules/PasswordField'
import { AuthErrorNotice } from '../molecules/AuthErrorNotice'
import { useSetPasswordFlow } from '../../auth/interface/react/hooks/useSetPasswordFlow'
import type { AuthLocalizationProps } from '../auth-presentation/types'

export interface SetPasswordFormProps extends AuthLocalizationProps {
  redirectTo?: string
}

export function SetPasswordForm({ redirectTo = '/', locale, messages }: SetPasswordFormProps) {
  const {
    password,
    confirmPassword,
    currentPassword,
    requiresReauthentication,
    error,
    isLoading,
    showPassword,
    strength,
    setPassword,
    setConfirmPassword,
    setCurrentPassword,
    setShowPassword,
    handleSubmit,
    handleReauthenticate,
    handleOtpReauthenticate,
  } = useSetPasswordFlow({ redirectTo, locale })

  const config = useAuthConfig()
  const params = useAuthSearchParams()
  const destination = params.get('redirect') ?? redirectTo
  const strengthBars = Array.from({ length: 5 }, (_, i) => i < strength.score)
  const theme = useAuthThemeClasses()
  const translations = useAuthTranslations(locale, messages)
  const t = translations.setPassword

  // Helper to translate error keys
  const getErrorMessage = (error: string | null) => authErrorMessage(error, translations)

  if (requiresReauthentication)
    return (
      <div className="space-y-4">
        <h2>{t.setPassword}</h2>
        <p>{t.reauthenticationIntro}</p>
        {error && <AuthErrorNotice>{getErrorMessage(error)}</AuthErrorNotice>}
        <PasswordField
          autoComplete="current-password"
          error={getErrorMessage(error)}
          label={t.currentPasswordLabel}
          value={currentPassword}
          onValueChange={setCurrentPassword}
        />
        <Button variant="primary" isLoading={isLoading} onPress={handleReauthenticate}>
          {t.reauthenticate}
        </Button>
        {config.otpLogin && (
          <Button variant="bordered" isLoading={isLoading} onPress={handleOtpReauthenticate}>
            {t.verifyByEmail}
          </Button>
        )}
        <AuthLink href={authRoute(config.authBasePath, 'login', {}, destination)}>
          {t.backToLogin}
        </AuthLink>
      </div>
    )
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <AuthErrorNotice>{getErrorMessage(error)}</AuthErrorNotice>}

      <PasswordField
        visible={showPassword}
        onToggleVisibility={() => setShowPassword(!showPassword)}
        visibilityLabel={showPassword ? t.hidePassword : t.showPassword}
        error={getErrorMessage(error)}
        label={t.newPasswordLabel}
        value={password}
        onValueChange={setPassword}
        isRequired
        autoFocus
        autoComplete="new-password"
      />

      {password.length > 0 && (
        <div className="flex gap-1">
          {strengthBars.map((active, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${active ? theme.strengthActive : theme.strengthInactive}`}
            />
          ))}
        </div>
      )}
      {password.length > 0 && !strength.isValid && (
        <p className={`text-xs ${theme.subtle}`}>{t.passwordRequirements}</p>
      )}

      <PasswordField
        visible={showPassword}
        error={getErrorMessage(error)}
        label={t.confirmPasswordLabel}
        value={confirmPassword}
        onValueChange={setConfirmPassword}
        isRequired
        autoComplete="new-password"
      />
      <Button type="submit" variant="primary" isLoading={isLoading}>
        {t.setPassword}
      </Button>
    </form>
  )
}
