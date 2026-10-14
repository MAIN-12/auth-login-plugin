'use client'

import { useAuthTranslations } from '../../../contexts/AuthAppearanceContext'

import { useAuthThemeClasses } from '../../../theme'
import { authErrorMessage } from '../../../i18n/ui'
import React from 'react'
import { useAuthConfig } from '../../../authentication/interface/react/providers/AuthConfigProvider/index'
import {
  AuthLink,
  useAuthSearchParams,
  authRoute,
} from '../../../authentication/interface/react/AuthFlowContext'
import { Button } from '../../atoms'
import { FormField } from '../../molecules/FormField'
import { AuthErrorNotice } from '../../molecules/AuthErrorNotice'
import { useForgotPasswordFlow } from '../../../authentication/interface/react/hooks/useForgotPasswordFlow'
import type { AuthLocalizationProps } from '../../../configuration/authAppearance/types'

export interface ForgotPasswordFormProps extends AuthLocalizationProps {
  loginUrl?: string
}

export function ForgotPasswordForm({ loginUrl, locale, messages }: ForgotPasswordFormProps) {
  const config = useAuthConfig()
  const params = useAuthSearchParams()
  const { email, emailError, isEmailValid, error, isLoading, setEmail, handleSubmit } =
    useForgotPasswordFlow(locale)
  const theme = useAuthThemeClasses()
  const translations = useAuthTranslations(locale, messages)
  const t = translations.forgotPassword

  // Helper to translate error keys
  const getErrorMessage = (error: string | null) => authErrorMessage(error, translations)

  return (
    <>
      <form noValidate onSubmit={handleSubmit} className="space-y-4">
        {error && <AuthErrorNotice>{getErrorMessage(error)}</AuthErrorNotice>}
        <FormField
          type="email"
          error={getErrorMessage(emailError || error)}
          label={t.emailLabel}
          value={email}
          onValueChange={setEmail}
          onBlur={() => setEmail(email)}
          isRequired
        />
        <Button type="submit" variant="primary" isLoading={isLoading} isDisabled={!isEmailValid}>
          {t.sendResetCode}
        </Button>
      </form>
      <div className="text-center mt-6">
        <AuthLink
          href={
            loginUrl ?? authRoute(config.authBasePath, 'login', {}, params.get('redirect') ?? '/')
          }
          className={`text-sm ${theme.muted} ${theme.hoverForeground} inline-flex items-center gap-1`}
        >
          ← {t.backToLogin}
        </AuthLink>
      </div>
    </>
  )
}
