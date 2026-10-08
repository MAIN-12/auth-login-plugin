'use client'

import { useAuthTranslations } from '../auth-presentation/AuthPresentationContext'

import { useAuthThemeClasses } from '../ui/theme'
import { authErrorMessage } from '../ui/translations'
import React from 'react'
import {
  AuthLink,
  authRoute,
  useAuthNavigation,
  useAuthSearchParams,
} from '../../auth/application/AuthFlowContext'
import { useAuthConfig } from '../AuthConfigContext'
import { createAuthService } from '../../auth/application/services/authService'
import { Button, Input, Divider } from '../ui/index'
import type { AuthLocalizationProps } from '../auth-presentation/types'

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
  const service = React.useMemo(() => createAuthService(config, locale), [config, locale])
  const params = useAuthSearchParams()
  const navigation = useAuthNavigation()
  const redirectTo = params.get('redirect') || '/'
  const [email, setEmail] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(() =>
    params.get('reason') === 'proof-expired' ? 'proofExpired' : null,
  )
  const theme = useAuthThemeClasses()
  const translations = useAuthTranslations(locale, messages)
  const t = translations.signup

  // Helper to translate error keys
  const getErrorMessage = (error: string | null) => authErrorMessage(error, translations)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      const sent = await service.sendOwnership(email, 'signup')
      if (!sent.success) throw new Error(sent.code)
      navigation.push(
        authRoute(
          config.authBasePath,
          'verify-otp',
          { email, purpose: 'signup', context: sent.context, retryAfter: sent.retryAfter },
          redirectTo,
        ),
      )
    } catch {
      setError('error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {showGoogleOAuth && config.googleOAuthEnabled && (
        <>
          <Button
            fullWidth
            variant="bordered"
            size="lg"
            className="mb-4 [--button-fg:var(--foreground)]"
            onPress={() => service.loginGoogle(redirectTo)}
          >
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
            </svg>
            {t.continueWithGoogle}
          </Button>
          <div className="flex items-center gap-4 my-4">
            <Divider className="flex-1" />
            <span className={`${theme.muted} text-sm`}>{t.or}</span>
            <Divider className="flex-1" />
          </div>
        </>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            role="alert"
            className={`${theme.error} border rounded-lg p-3 text-sm animate-[fadeIn_0.2s_ease-out]`}
          >
            {getErrorMessage(error)}
          </div>
        )}
        <Input
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
