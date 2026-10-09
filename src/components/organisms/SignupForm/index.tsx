'use client'

import { useAuthTranslations } from '../../../contexts/AuthAppearanceContext'

import { useAuthThemeClasses } from '../../../theme'
import { authErrorMessage } from '../../../i18n/ui'
import React from 'react'
import {
  AuthLink,
  authRoute,
  useAuthSearchParams,
} from '../../../auth/interface/react/AuthFlowContext'
import { useAuthConfig } from '../../../auth/interface/react/providers/AuthConfigProvider'
import { useSignupFlow } from '../../../auth/interface/react/hooks/useSignupFlow'
import { Button, Divider } from '../../atoms'
import { FormField } from '../../molecules/FormField'
import { AuthErrorNotice } from '../../molecules/AuthErrorNotice'
import { GoogleAuthButton } from '../../molecules/GoogleAuthButton'
import type { AuthLocalizationProps } from '../../../configuration/authAppearance/types'

export interface SignupFormProps extends AuthLocalizationProps {
  onSignup: (data: { name: string; email: string }) => Promise<void>
  showGoogleOAuth?: boolean
  loginUrl?: string
  verifyOtpUrl?: string
}

export function SignupForm({
  onSignup: _onSignup,
  showGoogleOAuth = true,
  loginUrl,
  verifyOtpUrl: _verifyOtpUrl,
  locale,
  messages,
}: SignupFormProps) {
  const config = useAuthConfig()
  const params = useAuthSearchParams()
  const redirectTo = params.get('redirect') || '/'
  const { email, setEmail, isLoading, error, handleSubmit, handleGoogleLogin } =
    useSignupFlow(locale)
  const theme = useAuthThemeClasses()
  const translations = useAuthTranslations(locale, messages)
  const t = translations.signup

  // Helper to translate error keys
  const getErrorMessage = (error: string | null) => authErrorMessage(error, translations)

  return (
    <>
      {showGoogleOAuth && config.googleOAuthEnabled && (
        <>
          <GoogleAuthButton
            fullWidth
            variant="bordered"
            size="lg"
            className="mb-4 [--button-fg:var(--foreground)]"
            onPress={handleGoogleLogin}
          >
            {t.continueWithGoogle}
          </GoogleAuthButton>
          <div className="flex items-center gap-4 my-4">
            <Divider className="flex-1" />
            <span className={`${theme.muted} text-sm`}>{t.or}</span>
            <Divider className="flex-1" />
          </div>
        </>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <AuthErrorNotice>{getErrorMessage(error)}</AuthErrorNotice>}
        <FormField
          type="email"
          error={getErrorMessage(error)}
          label={t.emailLabel}
          value={email}
          onValueChange={setEmail}
          isRequired
        />
        <p className={`text-xs ${theme.muted} text-center`}>
          {t.termsNotice}{' '}
          <a href="/terms" className={`${theme.foreground} hover:underline`}>
            {t.termsLink}
          </a>{' '}
          {t.andSeparator}{' '}
          <a href="/privacy" className={`${theme.foreground} hover:underline`}>
            {t.privacyLink}
          </a>
        </p>
        <Button type="submit" variant="primary" isLoading={isLoading}>
          {t.createAccount}
        </Button>
      </form>
      <p className={`text-center ${theme.muted} text-sm mt-6`}>
        {t.haveAccount}{' '}
        <AuthLink
          href={loginUrl ?? authRoute(config.authBasePath, 'login', {}, redirectTo)}
          className={`${theme.foreground} font-medium hover:underline`}
        >
          {t.loginLink}
        </AuthLink>
      </p>
    </>
  )
}
