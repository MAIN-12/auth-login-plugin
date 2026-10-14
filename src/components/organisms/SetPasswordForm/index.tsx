'use client'

import { useAuthTranslations } from '../../../contexts/AuthAppearanceContext'

import { useAuthThemeClasses } from '../../../theme'
import { authErrorMessage } from '../../../i18n/ui'
import React from 'react'
import { isExistingPasswordValid } from '../../../authentication/interface/react/formValidation'
import { useAuthConfig } from '../../../authentication/interface/react/providers/AuthConfigProvider/index'
import {
  AuthLink,
  useAuthSearchParams,
  authRoute,
} from '../../../authentication/interface/react/AuthFlowContext'
import { Button } from '../../atoms'
import { PasswordField } from '../../molecules/PasswordField'
import { AuthErrorNotice } from '../../molecules/AuthErrorNotice'
import { useSetPasswordFlow } from '../../../authentication/interface/react/hooks/useSetPasswordFlow'
import type { AuthLocalizationProps } from '../../../configuration/authAppearance/types'

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

  const passwordError = password && !strength.isValid ? 'passwordTooWeak' : null
  const confirmationError =
    confirmPassword && password !== confirmPassword ? 'passwordMismatch' : null
  const serverError = error === 'passwordMismatch' || error === 'passwordTooWeak' ? null : error

  if (requiresReauthentication)
    return (
      <div className="space-y-4">
        <p className={`text-center ${theme.muted} text-sm`}>{t.reauthenticationIntro}</p>
        {error && <AuthErrorNotice>{getErrorMessage(error)}</AuthErrorNotice>}
        <PasswordField
          autoComplete="current-password"
          error={getErrorMessage(error)}
          label={t.currentPasswordLabel}
          value={currentPassword}
          onValueChange={setCurrentPassword}
          variant="secondary"
          isRequired
        />
        <Button
          variant="primary"
          isLoading={isLoading}
          isDisabled={!isExistingPasswordValid(currentPassword)}
          onPress={handleReauthenticate}
        >
          {t.reauthenticate}
        </Button>
        {config.otpLogin && (
          <Button variant="secondary" isLoading={isLoading} onPress={handleOtpReauthenticate}>
            {t.verifyByEmail}
          </Button>
        )}
        <div className="text-center mt-6">
          <AuthLink
            href={authRoute(config.authBasePath, 'login', {}, destination)}
            className={`text-sm ${theme.muted} ${theme.hoverForeground} inline-flex items-center gap-1`}
          >
            ← {t.backToLogin}
          </AuthLink>
        </div>
      </div>
    )
  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-4">
      {error && <AuthErrorNotice>{getErrorMessage(error)}</AuthErrorNotice>}

      <PasswordField
        visible={showPassword}
        onToggleVisibility={() => setShowPassword(!showPassword)}
        visibilityLabel={showPassword ? t.hidePassword : t.showPassword}
        error={getErrorMessage(passwordError || serverError)}
        label={t.newPasswordLabel}
        value={password}
        onValueChange={setPassword}
        isRequired
        autoFocus
        autoComplete="new-password"
        variant="secondary"
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
        error={getErrorMessage(confirmationError || serverError)}
        label={t.confirmPasswordLabel}
        value={confirmPassword}
        onValueChange={setConfirmPassword}
        isRequired
        autoComplete="new-password"
        variant="secondary"
      />
      <Button
        type="submit"
        variant="primary"
        isLoading={isLoading}
        isDisabled={!strength.isValid || !confirmPassword || password !== confirmPassword}
      >
        {t.setPassword}
      </Button>
    </form>
  )
}
