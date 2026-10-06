'use client'

import { useAuthConfig } from '../AuthConfigContext'
import { useAllowSignup } from '../AuthSignupConfig'

import { useAuthTranslations } from '../auth-presentation/AuthPresentationContext'

import React, { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button, Input, Label, TextField, Separator, Spinner } from '@heroui/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '@iconify/react'
import { useLoginFlow } from '../../auth/application/hooks/useLoginFlow'
import { AuthLayout } from '../AuthLayout'
import type { AuthLayoutConfig } from '../AuthLayout'
import { AuthCard } from '../AuthCard'
import type { AuthCardConfig } from '../AuthCard'

export interface LoginPageHeroProps extends AuthLayoutConfig, AuthCardConfig {
  onPasswordLogin: (credentials: { email: string; password: string }) => Promise<void>
  redirectTo?: string
  showGoogleOAuth?: boolean
  signupUrl?: string
}

function LoginHeroContent({
  onPasswordLogin, redirectTo = '/', showGoogleOAuth = true, signupUrl = '/signup',
  logo, poweredBy, cardClassName, removeBorder, removeShadow, mobileVariant, backgroundClass, texture, locale, messages,
}: LoginPageHeroProps) {
  const config = useAuthConfig()
  const allowSignup = useAllowSignup()
  const searchParams = useSearchParams()
  const resolvedRedirect = searchParams.get('redirect') || redirectTo
  const t = useAuthTranslations(locale, messages).login

  const {
    step, email, password, error, isLoading, isSendingOtp, showPassword,
    setEmail, setPassword, setShowPassword,
    handleEmailSubmit, handlePasswordSubmit, handleSendOtp, handleEditEmail, handleGoogleLogin,
  } = useLoginFlow({ redirectTo: resolvedRedirect, onPasswordLogin })

  const stepTitle = step === 'otp-prompt' ? t.otpPromptTitle : step === 'email' ? t.title : t.passwordStepTitle
  const stepSubtitle = step === 'otp-prompt' ? t.otpPromptSubtitle : step === 'email' ? t.subtitle : t.passwordStepSubtitle

  return (
    <AuthLayout backgroundClass={backgroundClass} texture={texture}>
    <AuthCard logo={logo} title={stepTitle} subtitle={stepSubtitle}
      poweredBy={poweredBy} cardClassName={cardClassName} removeBorder={removeBorder} removeShadow={removeShadow} mobileVariant={mobileVariant}
      footer={allowSignup && signupUrl ? (
        <p className="text-center text-gray-600 text-sm">
          {t.noAccount}{' '}
          <a href={signupUrl} className="text-gray-900 font-medium hover:underline">{t.signUpLink}</a>
        </p>
      ) : undefined}
    >
      <AnimatePresence mode="wait">
        {step === 'email' && (
          <motion.div key="email" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3 }}>
            {showGoogleOAuth && config.googleOAuthEnabled && (
              <>
                <Button fullWidth variant="secondary" onPress={handleGoogleLogin} className="[--button-fg:var(--foreground)]">
                  <Icon icon="flat-color-icons:google" width={20} />
                  {t.continueWithGoogle}
                </Button>
                <div className="flex items-center gap-4 my-4"><Separator className="flex-1" /><span className="text-gray-500 text-sm">{t.or}</span><Separator className="flex-1" /></div>
              </>
            )}
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              {error && <motion.div className="bg-red-50 text-red-600 border border-red-200 rounded-lg p-3 text-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{error}</motion.div>}
              <TextField type="email" value={email} onChange={setEmail} isRequired fullWidth>
                <Label className="text-gray-600">{t.emailLabel}</Label>
                <Input variant="secondary" />
              </TextField>
              <Button type="submit" fullWidth size="lg" isPending={isLoading}>
                {({ isPending }) => (<>{isPending && <Spinner color="current" size="sm" />}{t.continue}</>)}
              </Button>
            </form>
          </motion.div>
        )}
        {step === 'password' && (
          <motion.div key="password" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
            <div className="flex items-center justify-between border border-gray-300 rounded-xl px-4 py-3 mb-4">
              <span className="text-gray-900 text-sm">{email}</span>
              <button type="button" onClick={handleEditEmail} className="text-gray-600 text-sm font-medium hover:text-gray-900">{t.edit}</button>
            </div>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              {error && <motion.div className="bg-red-50 text-red-600 border border-red-200 rounded-lg p-3 text-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{error}</motion.div>}
              <TextField type={showPassword ? 'text' : 'password'} value={password} onChange={setPassword} isRequired autoFocus fullWidth>
                <Label className="text-gray-600">{t.passwordLabel}</Label>
                <div className="relative">
                  <Input variant="secondary" />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setShowPassword(!showPassword)}>
                    <Icon icon={showPassword ? 'lucide:eye-off' : 'lucide:eye'} className="text-gray-400" width={20} />
                  </button>
                </div>
              </TextField>
              {config.recovery && <div className="text-left"><a href="/forgot-password" className="text-sm text-gray-700 hover:underline">{t.forgotPassword}</a></div>}
              <Button type="submit" fullWidth size="lg" isPending={isLoading} className="h-12 font-semibold">
                {({ isPending }) => (<>{isPending && <Spinner color="current" size="sm" />}{t.continue}</>)}
              </Button>
            </form>
          </motion.div>
        )}
        {step === 'otp-prompt' && (
          <motion.div key="otp-prompt" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
            <div className="flex items-center justify-between border border-gray-300 rounded-xl px-4 py-3 mb-4">
              <span className="text-gray-900 text-sm">{email}</span>
              <button type="button" onClick={handleEditEmail} className="text-gray-600 text-sm font-medium hover:text-gray-900">{t.edit}</button>
            </div>
            {error && <div className="bg-red-50 text-red-600 border border-red-200 rounded-lg p-3 text-sm mb-4">{error}</div>}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex gap-3">
              <Icon icon="lucide:mail" className="text-blue-500 mt-0.5" width={20} />
              <p className="text-sm text-blue-700">{t.verificationNotice}</p>
            </div>
            <Button fullWidth size="lg" isPending={isSendingOtp} onPress={handleSendOtp} className="h-12 font-semibold">
              {({ isPending }) => (<>{isPending && <Spinner color="current" size="sm" />}{isPending ? t.sendingCode : t.sendCode}</>)}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthCard>
    </AuthLayout>
  )
}

export default function LoginPageHero(props: LoginPageHeroProps) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>}>
      <LoginHeroContent {...props} />
    </Suspense>
  )
}