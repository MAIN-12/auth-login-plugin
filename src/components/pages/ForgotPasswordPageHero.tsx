'use client'

import { useAuthTranslations } from '../auth-presentation/AuthPresentationContext'

import React from 'react'
import { Button, Input, Label, TextField, Spinner } from '@heroui/react'
import { Icon } from '@iconify/react'
import { motion } from 'framer-motion'
import { useForgotPasswordFlow } from '../../auth/application/hooks/useForgotPasswordFlow'
import { AuthLayout } from '../AuthLayout'
import type { AuthLayoutConfig } from '../AuthLayout'
import { AuthCard } from '../AuthCard'
import type { AuthCardConfig } from '../AuthCard'

export interface ForgotPasswordPageHeroProps extends AuthLayoutConfig, AuthCardConfig { loginUrl?: string }

export default function ForgotPasswordPageHero({ loginUrl = '/login', logo, poweredBy, cardClassName, removeBorder, removeShadow, mobileVariant, backgroundClass, texture, locale, messages }: ForgotPasswordPageHeroProps) {
  const { email, error, isLoading, setEmail, handleSubmit } = useForgotPasswordFlow()
  const t = useAuthTranslations(locale, messages).forgotPassword
  return (
    <AuthLayout backgroundClass={backgroundClass} texture={texture}>
    <AuthCard logo={logo} title={t.title} subtitle={t.subtitle} poweredBy={poweredBy} cardClassName={cardClassName} removeBorder={removeBorder} removeShadow={removeShadow} mobileVariant={mobileVariant}
      footer={<a href={loginUrl} className="text-sm text-gray-600 hover:text-gray-900 inline-flex items-center gap-1"><Icon icon="lucide:arrow-left" width={16} />{t.backToLogin}</a>}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <motion.div className="bg-red-50 text-red-600 border border-red-200 rounded-lg p-3 text-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{error}</motion.div>}
        <TextField type="email" value={email} onChange={setEmail} isRequired fullWidth>
          <Label className="text-gray-600">{t.emailLabel}</Label>
          <Input variant="secondary" />
        </TextField>
        <Button type="submit" fullWidth size="lg" isPending={isLoading} className="h-12 font-semibold">
          {({ isPending }) => (<>{isPending && <Spinner color="current" size="sm" />}{t.sendResetCode}</>)}
        </Button>
      </form>
    </AuthCard>
    </AuthLayout>
  )
}