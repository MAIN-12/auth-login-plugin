'use client'

import React, { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button, OtpInput, Spinner } from '../ui/index'
import { useVerifyOtpFlow } from '../../auth/application/hooks/useVerifyOtpFlow'
import { AuthLayout } from '../AuthLayout'
import type { AuthLayoutConfig } from '../AuthLayout'

export interface VerifyOtpPageProps extends AuthLayoutConfig {
  loginUrl?: string
}

function VerifyOtpContent({
  loginUrl = '/login',
  logo, poweredBy, cardClassName, backgroundClass,
}: VerifyOtpPageProps) {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''
  const purpose = (searchParams.get('purpose') || 'login') as 'login' | 'signup' | 'password-reset'
  const redirectTo = searchParams.get('redirect') || '/'

  const { otp, error, isLoading, isResending, resendCooldown, setOtp, handleSubmit, handleResendCode } =
    useVerifyOtpFlow({ email, purpose, redirectTo })

  if (!email) return null

  const isPasswordReset = purpose === 'password-reset'

  return (
    <AuthLayout
      logo={logo}
      title={isPasswordReset ? 'Reset Password' : 'Check Your Email'}
      subtitle={isPasswordReset ? 'Enter the code to reset your password' : 'We sent a 6-digit code to'}
      poweredBy={poweredBy} cardClassName={cardClassName} backgroundClass={backgroundClass}
      footer={
        <a href={loginUrl} className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1">
          ← Back to Login
        </a>
      }
    >
      <div className="flex flex-col items-center gap-4">
        <p className="text-gray-700 text-sm font-medium">{email}</p>
        <OtpInput value={otp} onValueChange={setOtp} isDisabled={isLoading} autoFocus />
        {error && <div className="w-full bg-red-50 text-red-600 border border-red-200 rounded-lg p-3 text-sm animate-[fadeIn_0.2s_ease-out]">{error}</div>}
        <Button variant="primary" isLoading={isLoading} isDisabled={otp.length !== 6} onPress={handleSubmit}>Verify</Button>
        <div className="text-center">
          <p className="text-gray-600 text-sm mb-2">Didn't receive a code?</p>
          <button onClick={handleResendCode} disabled={isResending || resendCooldown > 0}
            className="text-[#0071e3] font-medium text-sm hover:underline disabled:opacity-50 disabled:cursor-not-allowed">
            {isResending ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
          </button>
        </div>
      </div>
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