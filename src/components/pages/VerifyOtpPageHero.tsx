'use client'

import React, { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button, InputOTP, Spinner } from '@heroui/react'
import { Icon } from '@iconify/react'
import { motion } from 'framer-motion'
import { useVerifyOtpFlow } from '../../auth/application/hooks/useVerifyOtpFlow'
import { AuthLayout } from '../AuthLayout'
import type { AuthLayoutConfig } from '../AuthLayout'
import { AuthCard } from '../AuthCard'
import type { AuthCardConfig } from '../AuthCard'
import { getUiTranslations } from '../ui/translations'

export interface VerifyOtpPageHeroProps extends AuthLayoutConfig, AuthCardConfig { loginUrl?: string }

function VerifyOtpHeroContent({ loginUrl = '/login', logo, poweredBy, cardClassName, removeBorder, removeShadow, mobileVariant, backgroundClass, locale, messages }: VerifyOtpPageHeroProps) {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''
  const purpose = (searchParams.get('purpose') || 'login') as 'login' | 'signup' | 'password-reset'
  const redirectTo = searchParams.get('redirect') || '/'
  const { otp, error, isLoading, isResending, resendCooldown, setOtp, handleSubmit, handleResendCode } = useVerifyOtpFlow({ email, purpose, redirectTo })
  const t = getUiTranslations(locale, messages).verifyOtp
  if (!email) return null

  return (
    <AuthLayout backgroundClass={backgroundClass}>
    <AuthCard logo={logo} title={purpose === 'password-reset' ? t.passwordResetTitle : t.title}
      subtitle={purpose === 'password-reset' ? t.passwordResetSubtitle : t.subtitle}
      poweredBy={poweredBy} cardClassName={cardClassName} removeBorder={removeBorder} removeShadow={removeShadow} mobileVariant={mobileVariant}
      footer={<a href={loginUrl} className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"><Icon icon="lucide:arrow-left" width={16} />{t.backToLogin}</a>}>
      <div className="flex flex-col items-center gap-4">
        <p className="text-gray-700 text-sm font-medium">{email}</p>
        <InputOTP maxLength={6} value={otp} onChange={setOtp} isDisabled={isLoading} autoFocus variant="secondary">
          <InputOTP.Group>
            <InputOTP.Slot index={0} />
            <InputOTP.Slot index={1} />
            <InputOTP.Slot index={2} />
          </InputOTP.Group>
          <InputOTP.Separator />
          <InputOTP.Group>
            <InputOTP.Slot index={3} />
            <InputOTP.Slot index={4} />
            <InputOTP.Slot index={5} />
          </InputOTP.Group>
        </InputOTP>
        {error && <motion.div className="w-full bg-red-50 text-red-600 border border-red-200 rounded-lg p-3 text-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{error}</motion.div>}
        <Button fullWidth size="lg" isPending={isLoading} isDisabled={otp.length !== 6} onPress={handleSubmit} className="h-12 font-semibold">
          {({ isPending }) => (<>{isPending && <Spinner color="current" size="sm" />}{t.verify}</>)}
        </Button>
        <div className="text-center"><p className="text-gray-600 text-sm mb-2">{t.noCodeReceived}</p>
          <button onClick={handleResendCode} disabled={isResending || resendCooldown > 0} className="text-primary font-medium text-sm hover:underline disabled:opacity-50">
            {isResending ? t.resending : resendCooldown > 0 ? t.resendIn.replace('{seconds}', String(resendCooldown)) : t.resendCode}
          </button>
        </div>
      </div>
    </AuthCard>
    </AuthLayout>
  )
}
export default function VerifyOtpPageHero(props: VerifyOtpPageHeroProps) {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>}><VerifyOtpHeroContent {...props} /></Suspense>
}