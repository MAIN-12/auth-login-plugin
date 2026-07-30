'use client'

import React from 'react'
import { Button, Input } from '../ui/index'
import { useForgotPasswordFlow } from '../../auth/application/hooks/useForgotPasswordFlow'
import { AuthLayout } from '../AuthLayout'
import type { AuthLayoutConfig } from '../AuthLayout'

export interface ForgotPasswordPageProps extends AuthLayoutConfig {
  loginUrl?: string
}

export default function ForgotPasswordPage({
  loginUrl = '/login',
  logo, poweredBy, cardClassName, backgroundClass,
}: ForgotPasswordPageProps) {
  const { email, error, isLoading, setEmail, handleSubmit } = useForgotPasswordFlow()

  return (
    <AuthLayout
      logo={logo} title="Forgot Password" subtitle="Enter your email and we'll send you a reset code"
      poweredBy={poweredBy} cardClassName={cardClassName} backgroundClass={backgroundClass}
      footer={
        <a href={loginUrl} className="text-sm text-gray-600 hover:text-gray-900 inline-flex items-center gap-1">
          ← Back to Login
        </a>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 text-red-600 border border-red-200 rounded-lg p-3 text-sm animate-[fadeIn_0.2s_ease-out]">{error}</div>}
        <Input type="email" label="Email" value={email} onChange={e => setEmail(e.target.value)} isRequired />
        <Button type="submit" variant="primary" isLoading={isLoading}>Send Reset Code</Button>
      </form>
    </AuthLayout>
  )
}