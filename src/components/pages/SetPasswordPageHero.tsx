'use client'

import { useAuthTranslations } from '../auth-presentation/AuthPresentationContext'

import React from 'react'
import { Button, Input, Label, TextField, Spinner } from '@heroui/react'
import { Icon } from '@iconify/react'
import { motion } from 'framer-motion'
import { useSetPasswordFlow } from '../../auth/application/hooks/useSetPasswordFlow'
import { AuthLayout } from '../AuthLayout'
import type { AuthLayoutConfig } from '../AuthLayout'
import { AuthCard } from '../AuthCard'
import type { AuthCardConfig } from '../AuthCard'

export interface SetPasswordPageHeroProps extends AuthLayoutConfig, AuthCardConfig { redirectTo?: string }

export default function SetPasswordPageHero({ redirectTo = '/', logo, poweredBy, cardClassName, removeBorder, removeShadow, mobileVariant, backgroundClass, texture, locale, messages }: SetPasswordPageHeroProps) {
  const { password, confirmPassword, error, isLoading, showPassword, strength, setPassword, setConfirmPassword, setShowPassword, handleSubmit } = useSetPasswordFlow({ redirectTo })
  const bars = Array.from({ length: 5 }, (_, i) => i < strength.score)
  const t = useAuthTranslations(locale, messages).setPassword

  return (
    <AuthLayout backgroundClass={backgroundClass} texture={texture}>
    <AuthCard logo={logo} title={t.title} subtitle={t.subtitle} poweredBy={poweredBy} cardClassName={cardClassName} removeBorder={removeBorder} removeShadow={removeShadow} mobileVariant={mobileVariant}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <motion.div className="bg-red-50 text-red-600 border border-red-200 rounded-lg p-3 text-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{error}</motion.div>}
        <TextField type={showPassword ? 'text' : 'password'} value={password} onChange={setPassword} isRequired autoFocus fullWidth>
          <Label className="text-gray-600">{t.newPasswordLabel}</Label>
          <div className="relative">
            <Input variant="secondary" className="w-full pr-10" />
            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setShowPassword(!showPassword)}>
              <Icon icon={showPassword ? 'lucide:eye-off' : 'lucide:eye'} className="text-gray-400" width={20} />
            </button>
          </div>
        </TextField>
        {password.length > 0 && <div className="flex gap-1">{bars.map((a, i) => <div key={i} className={`h-1 flex-1 rounded-full ${a ? 'bg-[#D5E855]' : 'bg-gray-200'}`} />)}</div>}
        <TextField type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={setConfirmPassword} isRequired fullWidth>
          <Label className="text-gray-600">{t.confirmPasswordLabel}</Label>
          <Input variant="secondary" className="w-full" />
        </TextField>
        <Button type="submit" fullWidth size="lg" isPending={isLoading} className="h-12 font-semibold">
          {({ isPending }) => (<>{isPending && <Spinner color="current" size="sm" />}{t.setPassword}</>)}
        </Button>
      </form>
    </AuthCard>
    </AuthLayout>
  )
}