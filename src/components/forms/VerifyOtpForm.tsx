'use client'

import { useAuthTranslations } from '../auth-presentation/AuthPresentationContext'

import { authErrorMessage } from '../ui/translations'
import React from 'react'
import { useAuthConfig } from '../AuthConfigContext'
import { authRoute } from '../../auth/application/AuthFlowContext'
import { AuthLoadingBoundary } from '../auth-card/AuthLoadingBoundary'
import { useAuthSearchParams, AuthLink } from '../../auth/application/AuthFlowContext'
import { Button, OtpInput } from '../ui/index'
import { useVerifyOtpFlow } from '../../auth/application/hooks/useVerifyOtpFlow'
import type { AuthLocalizationProps } from '../auth-presentation/types'

export interface VerifyOtpFormProps extends AuthLocalizationProps {
  loginUrl?: string
  /** Callback to update the card title based on purpose */
  onPurposeChange?: (purpose: 'login' | 'signup' | 'password-reset', title: string, subtitle: string) => void
}

function VerifyOtpFormContent({
  loginUrl,
  locale,
  messages,
  onPurposeChange,
}: VerifyOtpFormProps) {
  const config = useAuthConfig()
  const searchParams = useAuthSearchParams()
  const email = searchParams.get('email') || ''
  const requestedPurpose = searchParams.get('purpose') || 'login'
  const purpose = ['login', 'signup', 'password-reset', 'reauth'].includes(requestedPurpose) ? requestedPurpose as 'login' | 'signup' | 'password-reset' | 'reauth' : 'login'
  const redirectTo = searchParams.get('redirect') || '/'

  const { otp, error, isLoading, isResending, resendCooldown, setOtp, handleSubmit, handleResendCode } =
    useVerifyOtpFlow({ email, purpose, redirectTo, locale, context: searchParams.get('context') ?? '', retryAfter: Number(searchParams.get('retryAfter') ?? 0) })
  const translations = useAuthTranslations(locale, messages)
  const t = translations.verifyOtp

  // Helper to translate error keys
  const getErrorMessage = (error: string | null) => authErrorMessage(error, translations)

  const isPasswordReset = purpose === 'password-reset'

  // Notify parent of purpose for dynamic title/subtitle
  React.useEffect(() => {
    if (onPurposeChange) {
      const title = isPasswordReset ? t.passwordResetTitle : t.title
      const subtitle = isPasswordReset ? t.passwordResetSubtitle : t.subtitle
      onPurposeChange(purpose === 'reauth' ? 'login' : purpose, title, subtitle)
    }
  }, [purpose, onPurposeChange, t, isPasswordReset])

  if (!email || !/^[a-f0-9]{64}$/.test(searchParams.get('context') ?? '') || !['login', 'signup', 'password-reset', 'reauth'].includes(requestedPurpose)) return <div role="alert"><p>{t.incompleteLink}</p><AuthLink href={authRoute(config.authBasePath, purpose === 'signup' ? 'signup' : purpose === 'password-reset' ? 'forgot-password' : 'login', {}, redirectTo)}>{t.backToLogin}</AuthLink></div>

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-gray-700 text-sm font-medium">{email}</p>
      <OtpInput error={getErrorMessage(error)} locale={locale} value={otp} onValueChange={setOtp} isDisabled={isLoading} autoFocus />
      {error && <div role="alert" className="w-full bg-red-50 text-red-700 border border-red-200 rounded-lg p-3 text-sm animate-[fadeIn_0.2s_ease-out]">{getErrorMessage(error)}</div>}
      <Button variant="primary" isLoading={isLoading} isDisabled={!/^\d{6}$/.test(otp)} onPress={handleSubmit}>{t.verify}</Button>
      <div className="text-center">
        <p className="text-gray-600 text-sm mb-2">{t.noCodeReceived}</p>
        <button onClick={handleResendCode} disabled={isResending || resendCooldown > 0}
          className="text-[#0071e3] font-medium text-sm hover:underline disabled:opacity-50 disabled:cursor-not-allowed">
          {isResending ? t.resending : resendCooldown > 0 ? t.resendIn.replace('{seconds}', String(resendCooldown)) : t.resendCode}
        </button>
      </div>
      <div className="text-center mt-2">
        <AuthLink href={loginUrl ?? authRoute(config.authBasePath, 'login', {}, redirectTo)} className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1 justify-center">
          ← {t.backToLogin}
        </AuthLink>
      </div>
    </div>
  )
}

export function VerifyOtpForm(props: VerifyOtpFormProps) {
  return (
    <AuthLoadingBoundary>
      <VerifyOtpFormContent {...props} />
    </AuthLoadingBoundary>
  )
}
