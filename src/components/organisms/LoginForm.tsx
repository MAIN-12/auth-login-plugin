'use client'

import { safeAuthRedirect } from '../../auth/domain/redirect'
import { useAuthConfig } from '../AuthConfigContext'
import { useAllowSignup } from '../AuthSignupConfig'

import { useAuthTranslations } from '../auth-presentation/AuthPresentationContext'

import { useAuthThemeClasses } from '../ui/theme'
import { authErrorMessage } from '../ui/translations'
import React from 'react'
import { AuthLoadingBoundary } from './AuthCard/AuthLoadingBoundary'
import {
  useAuthSearchParams,
  AuthLink,
  authRoute,
} from '../../auth/interface/react/AuthFlowContext'
import { Button, Divider } from '../atoms'
import { FormField } from '../molecules/FormField'
import { PasswordField } from '../molecules/PasswordField'
import { AuthErrorNotice } from '../molecules/AuthErrorNotice'
import { useLoginFlow } from '../../auth/interface/react/hooks/useLoginFlow'
import { GoogleAuthButton } from '../molecules/GoogleAuthButton'
import type { AuthLocalizationProps } from '../auth-presentation/types'

export interface LoginFormProps extends AuthLocalizationProps {
  onPasswordLogin: (credentials: { email: string; password: string }) => Promise<void>
  redirectTo?: string
  showGoogleOAuth?: boolean
  signupUrl?: string
  /** Callback to update the card title based on current step */
  onStepChange?: (
    step: 'email' | 'password' | 'otp-prompt',
    title: string,
    subtitle: string,
  ) => void
}

function LoginFormContent({
  onPasswordLogin,
  redirectTo = '/',
  showGoogleOAuth = true,
  signupUrl,
  locale,
  messages,
  onStepChange,
}: LoginFormProps) {
  const config = useAuthConfig()
  const allowSignup = useAllowSignup()
  const searchParams = useAuthSearchParams()
  const resolvedRedirect = searchParams.get('redirect') || redirectTo
  const signupDestination = new URL(
    safeAuthRedirect(signupUrl, `${config.authBasePath}/signup`),
    'https://auth.invalid',
  )
  if (safeAuthRedirect(resolvedRedirect) !== '/')
    signupDestination.searchParams.set('redirect', safeAuthRedirect(resolvedRedirect))
  const signupHref = signupDestination.pathname + signupDestination.search + signupDestination.hash
  const theme = useAuthThemeClasses()
  const translations = useAuthTranslations(locale, messages)
  const t = translations.login

  // Helper to translate error keys
  const getErrorMessage = (error: string | null) => authErrorMessage(error, translations)

  const {
    step,
    email,
    password,
    error,
    isLoading,
    isSendingOtp,
    setEmail,
    setPassword,
    handleEmailSubmit,
    handlePasswordSubmit,
    handleSendOtp,
    handleEditEmail,
    handleGoogleLogin,
  } = useLoginFlow({ redirectTo: resolvedRedirect, onPasswordLogin, locale })

  // Notify parent of step changes for dynamic title/subtitle
  React.useEffect(() => {
    if (onStepChange) {
      const title =
        step === 'otp-prompt' ? t.otpPromptTitle : step === 'email' ? t.title : t.passwordStepTitle
      const subtitle =
        step === 'otp-prompt'
          ? t.otpPromptSubtitle
          : step === 'email'
            ? t.subtitle
            : t.passwordStepSubtitle
      onStepChange(step, title, subtitle)
    }
  }, [step, onStepChange, t])

  return (
    <>
      {/* STEP 1: Email */}
      {step === 'email' && (
        <div className="animate-[fadeIn_0.3s_ease-out]">
          {showGoogleOAuth && config.googleOAuthEnabled && (
            <>
              <GoogleAuthButton
                fullWidth
                variant="secondary"
                size="lg"
                className="mb-4 [--button-fg:var(--foreground)]"
                onPress={handleGoogleLogin}
              >
                {t.continueWithGoogle}
              </GoogleAuthButton>
              {(config.passwordLogin || config.otpLogin) && (
                <div className="flex items-center gap-4 my-4">
                  <Divider className="flex-1" />
                  <span className={`${theme.muted} text-sm`}>{t.or}</span>
                  <Divider className="flex-1" />
                </div>
              )}
            </>
          )}
          {(config.passwordLogin || config.otpLogin) && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              {error && <AuthErrorNotice>{getErrorMessage(error)}</AuthErrorNotice>}
              <FormField
                type="email"
                error={getErrorMessage(error)}
                label={t.emailLabel}
                value={email}
                onValueChange={setEmail}
                isRequired
                variant="secondary"
              />
              <Button type="submit" variant="primary" isLoading={isLoading}>
                {t.continue}
              </Button>
            </form>
          )}
          {allowSignup && config.passwordLogin && signupUrl && (
            <p className={`text-center ${theme.muted} text-sm mt-6`}>
              {t.noAccount}{' '}
              <AuthLink
                href={signupHref}
                className={`${theme.foreground} font-medium hover:underline`}
              >
                {t.signUpLink}
              </AuthLink>
            </p>
          )}
        </div>
      )}

      {/* STEP 2a: Password */}
      {step === 'password' && (
        <div className="animate-[fadeIn_0.3s_ease-out]">
          <div
            className={`flex items-center justify-between border ${theme.border} rounded-xl px-4 py-3 mb-4`}
          >
            <span className={`${theme.foreground} text-sm`}>{email}</span>
            <button
              type="button"
              onClick={handleEditEmail}
              className={`${theme.muted} text-sm font-medium ${theme.hoverForeground}`}
            >
              {t.edit}
            </button>
          </div>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {error && <AuthErrorNotice>{getErrorMessage(error)}</AuthErrorNotice>}
            <PasswordField
              error={getErrorMessage(error)}
              label={t.passwordLabel}
              value={password}
              onValueChange={setPassword}
              isRequired
              autoFocus
              variant="secondary"
            />
            {config.recovery && (
              <div className="text-left">
                <AuthLink
                  href={authRoute(config.authBasePath, 'forgot-password', {}, resolvedRedirect)}
                  className={`text-sm ${theme.secondaryForeground} ${theme.hoverForeground} hover:underline`}
                >
                  {t.forgotPassword}
                </AuthLink>
              </div>
            )}
            <Button type="submit" variant="primary" isLoading={isLoading}>
              {t.continue}
            </Button>
          </form>
          {config.otpLogin && (
            <Button variant="secondary" isLoading={isSendingOtp} onPress={handleSendOtp}>
              {t.sendCode}
            </Button>
          )}
        </div>
      )}

      {/* STEP 2b: OTP Prompt */}
      {step === 'otp-prompt' && (
        <div className="animate-[fadeIn_0.3s_ease-out]">
          <div
            className={`flex items-center justify-between border ${theme.border} rounded-xl px-4 py-3 mb-4`}
          >
            <span className={`${theme.foreground} text-sm`}>{email}</span>
            <button
              type="button"
              onClick={handleEditEmail}
              className={`${theme.muted} text-sm font-medium ${theme.hoverForeground}`}
            >
              {t.edit}
            </button>
          </div>
          {error && <AuthErrorNotice className="mb-4">{getErrorMessage(error)}</AuthErrorNotice>}
          <div className={`${theme.notice} border rounded-lg p-4 mb-4`}>
            <div className="flex gap-3">
              <span className={`${theme.noticeIcon} text-lg`}>✉</span>
              <p className={`text-sm ${theme.noticeText}`}>{t.verificationNotice}</p>
            </div>
          </div>
          <Button variant="primary" isLoading={isSendingOtp} onPress={handleSendOtp}>
            {isSendingOtp ? t.sendingCode : t.sendCode}
          </Button>
        </div>
      )}
    </>
  )
}

export function LoginForm(props: LoginFormProps) {
  return (
    <AuthLoadingBoundary>
      <LoginFormContent {...props} />
    </AuthLoadingBoundary>
  )
}
