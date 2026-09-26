'use client'

import React from 'react'
import { Button, Input, Label, TextField, Separator, Spinner } from '@heroui/react'
import { Icon } from '@iconify/react'
import { motion } from 'framer-motion'
import { AuthLayout } from '../AuthLayout'
import type { AuthLayoutConfig } from '../AuthLayout'
import { AuthCard } from '../AuthCard'
import type { AuthCardConfig } from '../AuthCard'
import { getUiTranslations } from '../ui/translations'

export interface SignupPageHeroProps extends AuthLayoutConfig, AuthCardConfig {
  onSignup: (data: { name: string; email: string }) => Promise<void>
  showGoogleOAuth?: boolean
  loginUrl?: string
}

export default function SignupPageHero({ onSignup, showGoogleOAuth = true, loginUrl = '/login', logo, poweredBy, cardClassName, removeBorder, removeShadow, mobileVariant, backgroundClass, locale, messages }: SignupPageHeroProps) {
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const t = getUiTranslations(locale, messages).signup

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsLoading(true); setError(null)
    try { await onSignup({ name, email }); window.location.href = `/verify-otp?email=${encodeURIComponent(email)}&purpose=signup` }
    catch (err: any) { setError(err.message || 'Signup failed') }
    finally { setIsLoading(false) }
  }

  return (
    <AuthLayout backgroundClass={backgroundClass}>
    <AuthCard logo={logo} title={t.title} subtitle={t.subtitle} poweredBy={poweredBy} cardClassName={cardClassName} removeBorder={removeBorder} removeShadow={removeShadow} mobileVariant={mobileVariant}
      footer={<p className="text-center text-gray-600 text-sm">{t.haveAccount} <a href={loginUrl} className="text-gray-900 font-medium hover:underline">{t.loginLink}</a></p>}>
      {showGoogleOAuth && (<>
        <Button fullWidth variant="secondary" size="lg" className="mb-4 h-12 rounded-full [--button-fg:var(--foreground)]">
          <Icon icon="flat-color-icons:google" width={20} />
          {t.continueWithGoogle}
        </Button>
        <div className="flex items-center gap-4 my-4"><Separator className="flex-1" /><span className="text-gray-500 text-sm">{t.or}</span><Separator className="flex-1" /></div>
      </>)}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <motion.div className="bg-red-50 text-red-600 border border-red-200 rounded-lg p-3 text-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{error}</motion.div>}
        <TextField type="text" value={name} onChange={setName} isRequired fullWidth>
          <Label className="text-gray-600">{t.fullNameLabel}</Label>
          <Input variant="secondary" />
        </TextField>
        <TextField type="email" value={email} onChange={setEmail} isRequired fullWidth>
          <Label className="text-gray-600">{t.emailLabel}</Label>
          <Input variant="secondary" />
        </TextField>
        <p className="text-xs text-gray-600 text-center">{t.termsNotice} <a href="/terms" className="text-gray-900 hover:underline">{t.termsLink}</a> {t.andSeparator} <a href="/privacy" className="text-gray-900 hover:underline">{t.privacyLink}</a></p>
        <Button type="submit" fullWidth size="lg" isPending={isLoading} className="h-12 font-semibold">
          {({ isPending }) => (<>{isPending && <Spinner color="current" size="sm" />}{t.createAccount}</>)}
        </Button>
      </form>
    </AuthCard>
    </AuthLayout>
  )
}