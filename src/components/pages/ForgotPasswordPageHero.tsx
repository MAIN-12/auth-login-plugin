'use client'

import React from 'react'
import { Button, Input } from '@heroui/react'
import { Icon } from '@iconify/react'
import { motion } from 'framer-motion'
import { useForgotPasswordFlow } from '../../auth/application/hooks/useForgotPasswordFlow.js'
import { AuthLayout } from '../AuthLayout.js'
import type { AuthLayoutConfig } from '../AuthLayout.js'

export interface ForgotPasswordPageHeroProps extends AuthLayoutConfig { loginUrl?: string }

export default function ForgotPasswordPageHero({ loginUrl = '/login', logo, poweredBy, cardClassName, backgroundClass }: ForgotPasswordPageHeroProps) {
  const { email, error, isLoading, setEmail, handleSubmit } = useForgotPasswordFlow()
  return (
    <AuthLayout logo={logo} title="Forgot Password" subtitle="Enter your email and we'll send you a reset code" poweredBy={poweredBy} cardClassName={cardClassName} backgroundClass={backgroundClass}
      footer={<a href={loginUrl} className="text-sm text-gray-600 hover:text-gray-900 inline-flex items-center gap-1"><Icon icon="lucide:arrow-left" width={16} />Back to Login</a>}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <motion.div className="bg-red-50 text-red-600 border border-red-200 rounded-lg p-3 text-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{error}</motion.div>}
        <Input type="email" label="Email" value={email} onChange={e => setEmail(e.target.value)} variant="bordered" size="lg" isRequired classNames={{ input: 'text-gray-900', label: 'text-gray-600', inputWrapper: 'border-gray-300 bg-white' }} />
        <Button type="submit" fullWidth size="lg" color="primary" isLoading={isLoading} className="h-12 font-semibold">Send Reset Code</Button>
      </form>
    </AuthLayout>
  )
}