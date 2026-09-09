'use client'

import React, { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button, Input, Divider, Spinner } from '../ui/index'
import { useLoginFlow } from '../../auth/application/hooks/useLoginFlow'
import { AuthLayout } from '../AuthLayout'
import type { AuthLayoutConfig } from '../AuthLayout'

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
      footer={signupUrl ? (
        <p className="text-center text-gray-600 text-sm">
          Don't have an account?{' '}
          <a href={signupUrl} className="text-gray-900 font-medium hover:underline">Sign up</a>
        </p>
      ) : undefined}
    >
      {/* STEP 1: Email */}
      {step === 'email' && (
        <div className="animate-[fadeIn_0.3s_ease-out]">
{showGoogleOAuth && (
              <>
                <Button fullWidth variant="secondary" size="lg" className="mb-4" onPress={handleGoogleLogin}>
                  <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                  Continue with Google
                </Button>
                <div className="flex items-center gap-4 my-4">
                  <Divider className="flex-1" /><span className="text-gray-500 text-sm">or</span><Divider className="flex-1" />
                </div>
              </>
            )}
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              {error && <div className="bg-red-50 text-red-600 border border-red-200 rounded-lg p-3 text-sm">{error}</div>}
              <Input type="email" label="Email" value={email} onValueChange={setEmail} isRequired variant="secondary" />
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
            <Input type={showPassword ? 'text' : 'password'} label="Password" value={password} onValueChange={setPassword} isRequired autoFocus variant="secondary" />
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