'use client'

import React, { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button, Input, Divider, Spinner } from '../ui/index.js'
import { useLoginFlow } from '../../auth/application/hooks/useLoginFlow.js'
import { AuthLayout } from '../AuthLayout.js'
import type { AuthLayoutConfig } from '../AuthLayout.js'

export interface LoginPageProps extends AuthLayoutConfig {
  onPasswordLogin: (credentials: { email: string; password: string }) => Promise<void>
  redirectTo?: string
  showGoogleOAuth?: boolean
  signupUrl?: string
}

function LoginContent({
  onPasswordLogin, redirectTo = '/', showGoogleOAuth = true, signupUrl = '/signup',
  logo, poweredBy, cardClassName, backgroundClass,
}: LoginPageProps) {
  const searchParams = useSearchParams()
  const resolvedRedirect = searchParams.get('redirect') || redirectTo

  const {
    step, email, password, error, isLoading, isSendingOtp, showPassword,
    setEmail, setPassword, setShowPassword,
    handleEmailSubmit, handlePasswordSubmit, handleSendOtp, handleEditEmail, handleGoogleLogin,
  } = useLoginFlow({ redirectTo: resolvedRedirect, onPasswordLogin })

  const stepTitle = step === 'otp-prompt' ? 'Verify Identity' : step === 'email' ? 'Welcome Back' : 'Enter Password'
  const stepSubtitle = step === 'otp-prompt' ? "We need to verify it's you." : step === 'email' ? 'Sign in with your email to continue.' : 'Enter your password to sign in.'

  return (
    <AuthLayout logo={logo} title={stepTitle} subtitle={stepSubtitle}
      poweredBy={poweredBy} cardClassName={cardClassName} backgroundClass={backgroundClass}
      footer={
        <p className="text-center text-gray-600 text-sm">
          Don't have an account?{' '}
          <a href={signupUrl} className="text-gray-900 font-medium hover:underline">Sign up</a>
        </p>
      }
    >
      {/* STEP 1: Email */}
      {step === 'email' && (
        <div className="animate-[fadeIn_0.3s_ease-out]">
          {showGoogleOAuth && (
            <>
              <Button fullWidth variant="bordered" size="lg" className="mb-4" onPress={handleGoogleLogin}>
                <span className="text-lg">G</span> Continue with Google
              </Button>
              <div className="flex items-center gap-4 my-4">
                <Divider className="flex-1" /><span className="text-gray-500 text-sm">or</span><Divider className="flex-1" />
              </div>
            </>
          )}
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {error && <div className="bg-red-50 text-red-600 border border-red-200 rounded-lg p-3 text-sm">{error}</div>}
            <Input type="email" label="Email" value={email} onValueChange={setEmail} isRequired />
            <Button type="submit" variant="primary" isLoading={isLoading}>Continue</Button>
          </form>
        </div>
      )}

      {/* STEP 2a: Password */}
      {step === 'password' && (
        <div className="animate-[fadeIn_0.3s_ease-out]">
          <div className="flex items-center justify-between border border-gray-300 rounded-xl px-4 py-3 mb-4">
            <span className="text-gray-900 text-sm">{email}</span>
            <button type="button" onClick={handleEditEmail} className="text-gray-600 text-sm font-medium hover:text-gray-900">Edit</button>
          </div>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {error && <div className="bg-red-50 text-red-600 border border-red-200 rounded-lg p-3 text-sm">{error}</div>}
            <div className="relative">
              <Input type={showPassword ? 'text' : 'password'} label="Password" value={password} onValueChange={setPassword} isRequired autoFocus />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-9 text-gray-400 hover:text-gray-600">
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
            <div className="text-left">
              <a href="/forgot-password" className="text-sm text-gray-700 hover:text-gray-900 hover:underline">Forgot password?</a>
            </div>
            <Button type="submit" variant="primary" isLoading={isLoading}>Continue</Button>
          </form>
        </div>
      )}

      {/* STEP 2b: OTP Prompt */}
      {step === 'otp-prompt' && (
        <div className="animate-[fadeIn_0.3s_ease-out]">
          <div className="flex items-center justify-between border border-gray-300 rounded-xl px-4 py-3 mb-4">
            <span className="text-gray-900 text-sm">{email}</span>
            <button type="button" onClick={handleEditEmail} className="text-gray-600 text-sm font-medium hover:text-gray-900">Edit</button>
          </div>
          {error && <div className="bg-red-50 text-red-600 border border-red-200 rounded-lg p-3 text-sm mb-4">{error}</div>}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex gap-3">
              <span className="text-blue-500 text-lg">✉</span>
              <p className="text-sm text-blue-700">We'll send a verification code to this email.</p>
            </div>
          </div>
          <Button variant="primary" isLoading={isSendingOtp} onPress={handleSendOtp}>
            {isSendingOtp ? 'Sending...' : 'Send Code'}
          </Button>
        </div>
      )}
    </AuthLayout>
  )
}

export default function LoginPage(props: LoginPageProps) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>}>
      <LoginContent {...props} />
    </Suspense>
  )
}