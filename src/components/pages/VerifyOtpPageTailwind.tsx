'use client'

import { useAuthTranslations } from '../auth-presentation/AuthPresentationContext'

import React, { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button, OtpInput, Spinner } from '../ui/index'
import { useVerifyOtpFlow } from '../../auth/application/hooks/useVerifyOtpFlow'
import { AuthLayout } from '../AuthLayout'
import type { AuthLayoutConfig } from '../AuthLayout'
import { AuthCard } from '../AuthCard'
import type { AuthCardConfig } from '../AuthCard'

export interface VerifyOtpPageProps extends AuthLayoutConfig, AuthCardConfig {
  loginUrl?: string
}

function VerifyOtpContent({
  loginUrl = '/login',
  logo, poweredBy, cardClassName, removeBorder, removeShadow, mobileVariant, backgroundClass, texture, locale, messages,
}: VerifyOtpPageProps) {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''
  const purpose = (searchParams.get('purpose') || 'login') as 'login' | 'signup' | 'password-reset'
  const redirectTo = searchParams.get('redirect') || '/'

  const { otp, error, isLoading, isResending, resendCooldown, setOtp, handleSubmit, handleResendCode } =
    useVerifyOtpFlow({ email, purpose, redirectTo })
  const t = useAuthTranslations(locale, messages).verifyOtp

  if (!email) return null

  const isPasswordReset = purpose === 'password-reset'

  return (
    <AuthLayout backgroundClass={backgroundClass} texture={texture}>
    <AuthCard
      logo={logo}
      title={isPasswordReset ? t.passwordResetTitle : t.title}
      subtitle={isPasswordReset ? t.passwordResetSubtitle : t.subtitle}
      poweredBy={poweredBy} cardClassName={cardClassName} removeBorder={removeBorder} removeShadow={removeShadow} mobileVariant={mobileVariant}
      footer={
        <a href={loginUrl} className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1">
          ← {t.backToLogin}
        </a>
      }
    >
      <div className="flex flex-col items-center gap-4">
        <p className="text-gray-700 text-sm font-medium">{email}</p>
        <OtpInput value={otp} onValueChange={setOtp} isDisabled={isLoading} autoFocus />
        {error && <div className="w-full bg-red-50 text-red-600 border border-red-200 rounded-lg p-3 text-sm animate-[fadeIn_0.2s_ease-out]">{error}</div>}
        <Button variant="primary" isLoading={isLoading} isDisabled={otp.length !== 6} onPress={handleSubmit}>{t.verify}</Button>
        <div className="text-center">
          <p className="text-gray-600 text-sm mb-2">{t.noCodeReceived}</p>
          <button onClick={handleResendCode} disabled={isResending || resendCooldown > 0}
            className="text-[#0071e3] font-medium text-sm hover:underline disabled:opacity-50 disabled:cursor-not-allowed">
            {isResending ? t.resending : resendCooldown > 0 ? t.resendIn.replace('{seconds}', String(resendCooldown)) : t.resendCode}
          </button>
        </div>
      </div>
    </AuthCard>
    </AuthLayout>
  )
}

export default function VerifyOtpPage(props: VerifyOtpPageProps) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>}>
      <VerifyOtpContent {...props} />
    </Suspense>
  )
}