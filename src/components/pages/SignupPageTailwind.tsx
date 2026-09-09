'use client'

import React from 'react'
import { Button, Input, Divider } from '../ui/index'
import { AuthLayout } from '../AuthLayout'
import type { AuthLayoutConfig } from '../AuthLayout'

export interface SignupPageProps extends AuthLayoutConfig {
  onSignup: (data: { name: string; email: string }) => Promise<void>
  showGoogleOAuth?: boolean
  loginUrl?: string
}

export default function SignupPage({
  onSignup,
  showGoogleOAuth = true,
  loginUrl = '/login',
  logo, poweredBy, cardClassName, backgroundClass,
}: SignupPageProps) {
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      await onSignup({ name, email })
      window.location.href = `/verify-otp?email=${encodeURIComponent(email)}&purpose=signup`
    } catch (err: any) {
      setError(err.message || 'Signup failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout
      logo={logo} title="Create Account" subtitle="Enter your details to get started"
      poweredBy={poweredBy} cardClassName={cardClassName} backgroundClass={backgroundClass}
      footer={
        <p className="text-center text-gray-600 text-sm">
          Already have an account?{' '}
          <a href={loginUrl} className="text-gray-900 font-medium hover:underline">Sign in</a>
        </p>
      }
    >
      {showGoogleOAuth && (
        <>
          <Button fullWidth variant="bordered" size="lg" className="mb-4">
            <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            Continue with Google
          </Button>
          <div className="flex items-center gap-4 my-4">
            <Divider className="flex-1" />
            <span className="text-gray-500 text-sm">or</span>
            <Divider className="flex-1" />
          </div>
        </>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 text-red-600 border border-red-200 rounded-lg p-3 text-sm animate-[fadeIn_0.2s_ease-out]">{error}</div>}
        <Input label="Full Name" value={name} onValueChange={setName} isRequired />
        <Input type="email" label="Email" value={email} onValueChange={setEmail} isRequired />
        <p className="text-xs text-gray-600 text-center">
          By signing up, you agree to our{' '}
          <a href="/terms" className="text-gray-900 hover:underline">Terms of Service</a> and{' '}
          <a href="/privacy" className="text-gray-900 hover:underline">Privacy Policy</a>
        </p>
        <Button type="submit" variant="primary" isLoading={isLoading}>Create Account</Button>
      </form>
    </AuthLayout>
  )
}