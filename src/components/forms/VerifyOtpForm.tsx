'use client'

import { useAuthTranslations } from '../auth-presentation/AuthPresentationContext'

import React from 'react'
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
  loginUrl = '/login',
  locale,
  messages,
  onPurposeChange,
}: VerifyOtpFormProps) {
  const searchParams = useAuthSearchParams()
  const email = searchParams.get('email') || ''
  const purpose = (searchParams.get('purpose') || 'login') as 'login' | 'signup' | 'password-reset'
  const redirectTo = searchParams.get('redirect') || '/'

  const { otp, error, isLoading, isResending, resendCooldown, setOtp, handleSubmit, handleResendCode } =
    useVerifyOtpFlow({ email, purpose, redirectTo, context: searchParams.get('context') ?? '', retryAfter: Number(searchParams.get('retryAfter') ?? 0) })
  const translations = useAuthTranslations(locale, messages)
  const t = translations.verifyOtp
  const errors = translations.errors

  // Helper to translate error keys
  const getErrorMessage = (err: string | null): string | null => {
    if (!err) return null
    if (err in errors) return errors[err as keyof typeof errors]
    return err
  }

  const isPasswordReset = purpose === 'password-reset'

  // Notify parent of purpose for dynamic title/subtitle
  React.useEffect(() => {
    if (onPurposeChange) {
      const title = isPasswordReset ? t.passwordResetTitle : t.title
      const subtitle = isPasswordReset ? t.passwordResetSubtitle : t.subtitle
      onPurposeChange(purpose, title, subtitle)
    }
  }, [purpose, onPurposeChange, t, isPasswordReset])

  if (!email) return null

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-gray-700 text-sm font-medium">{email}</p>
      <OtpInput value={otp} onValueChange={setOtp} isDisabled={isLoading} autoFocus />
      {error && <div className="w-full bg-red-50 text-red-600 border border-red-200 rounded-lg p-3 text-sm animate-[fadeIn_0.2s_ease-out]">{getErrorMessage(error)}</div>}
      <Button variant="primary" isLoading={isLoading} isDisabled={otp.length !== 6} onPress={handleSubmit}>{t.verify}</Button>
      <div className="text-center">
        <p className="text-gray-600 text-sm mb-2">{t.noCodeReceived}</p>
        <button onClick={handleResendCode} disabled={isResending || resendCooldown > 0}
          className="text-[#0071e3] font-medium text-sm hover:underline disabled:opacity-50 disabled:cursor-not-allowed">
          {isResending ? t.resending : resendCooldown > 0 ? t.resendIn.replace('{seconds}', String(resendCooldown)) : t.resendCode}
        </button>
      </div>
      <div className="text-center mt-2">
        <AuthLink href={loginUrl} className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1 justify-center">
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
