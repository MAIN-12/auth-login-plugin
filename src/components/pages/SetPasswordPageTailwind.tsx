'use client'

import React from 'react'
import { Button, Input } from '../ui/index'
import { useSetPasswordFlow } from '../../auth/application/hooks/useSetPasswordFlow'
import { AuthLayout } from '../AuthLayout'
import type { AuthLayoutConfig } from '../AuthLayout'
import { AuthCard } from '../AuthCard'
import type { AuthCardConfig } from '../AuthCard'
import { getUiTranslations } from '../ui/translations'

export interface SetPasswordPageProps extends AuthLayoutConfig, AuthCardConfig {
  redirectTo?: string
}

export default function SetPasswordPage({
  redirectTo = '/',
  logo, poweredBy, cardClassName, removeBorder, removeShadow, mobileVariant, backgroundClass, locale, messages,
}: SetPasswordPageProps) {
  const {
    password, confirmPassword, error, isLoading, showPassword, strength,
    setPassword, setConfirmPassword, setShowPassword, handleSubmit,
  } = useSetPasswordFlow({ redirectTo })

  const strengthBars = Array.from({ length: 5 }, (_, i) => i < strength.score)
  const t = getUiTranslations(locale, messages).setPassword

  return (
    <AuthLayout backgroundClass={backgroundClass}>
    <AuthCard
      logo={logo} title={t.title} subtitle={t.subtitle}
      poweredBy={poweredBy} cardClassName={cardClassName} removeBorder={removeBorder} removeShadow={removeShadow} mobileVariant={mobileVariant}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 text-red-600 border border-red-200 rounded-lg p-3 text-sm animate-[fadeIn_0.2s_ease-out]">{error}</div>}

        <div className="relative">
          <Input type={showPassword ? 'text' : 'password'} label={t.newPasswordLabel} value={password} onValueChange={setPassword} isRequired autoFocus />
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
          <p className="text-xs text-gray-500">{t.passwordRequirements}</p>
        )}

        <Input type={showPassword ? 'text' : 'password'} label={t.confirmPasswordLabel} value={confirmPassword} onValueChange={setConfirmPassword} isRequired />
        <Button type="submit" variant="primary" isLoading={isLoading}>{t.setPassword}</Button>
      </form>
    </AuthCard>
    </AuthLayout>
  )
}