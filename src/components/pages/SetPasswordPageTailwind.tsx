'use client'

import React from 'react'
import { Button, Input } from '../ui/index.js'
import { useSetPasswordFlow } from '../../auth/application/hooks/useSetPasswordFlow.js'
import { AuthLayout } from '../AuthLayout.js'
import type { AuthLayoutConfig } from '../AuthLayout.js'

export interface SetPasswordPageProps extends AuthLayoutConfig {
  redirectTo?: string
}

export default function SetPasswordPage({
  redirectTo = '/',
  logo, poweredBy, cardClassName, backgroundClass,
}: SetPasswordPageProps) {
  const {
    password, confirmPassword, error, isLoading, showPassword, strength,
    setPassword, setConfirmPassword, setShowPassword, handleSubmit,
  } = useSetPasswordFlow({ redirectTo })

  const strengthBars = Array.from({ length: 5 }, (_, i) => i < strength.score)

  return (
    <AuthLayout
      logo={logo} title="Set Your Password" subtitle="Create a secure password for your account"
      poweredBy={poweredBy} cardClassName={cardClassName} backgroundClass={backgroundClass}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 text-red-600 border border-red-200 rounded-lg p-3 text-sm animate-[fadeIn_0.2s_ease-out]">{error}</div>}

        <div className="relative">
          <Input type={showPassword ? 'text' : 'password'} label="New Password" value={password} onValueChange={setPassword} isRequired autoFocus />
          <button type="button" onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-9 text-gray-400 hover:text-gray-600">
            {showPassword ? '🙈' : '👁'}
          </button>
        </div>

        {password.length > 0 && (
          <div className="flex gap-1">
            {strengthBars.map((active, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full ${active ? 'bg-[#D5E855]' : 'bg-gray-200'}`} />
            ))}
          </div>
        )}
        {password.length > 0 && !strength.isValid && (
          <p className="text-xs text-gray-500">At least 8 chars with 3 of: uppercase, lowercase, number, special character</p>
        )}

        <Input type={showPassword ? 'text' : 'password'} label="Confirm Password" value={confirmPassword} onValueChange={setConfirmPassword} isRequired />
        <Button type="submit" variant="primary" isLoading={isLoading}>Set Password</Button>
      </form>
    </AuthLayout>
  )
}