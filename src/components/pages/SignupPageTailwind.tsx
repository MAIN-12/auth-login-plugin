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
            <span className="text-lg">G</span> Continue with Google
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