'use client'

import React from 'react'
import { Button, Input, Label, TextField, Spinner } from '@heroui/react'
import { Icon } from '@iconify/react'
import { motion } from 'framer-motion'
import { useForgotPasswordFlow } from '../../auth/application/hooks/useForgotPasswordFlow'
import { AuthLayout } from '../AuthLayout'
import type { AuthLayoutConfig } from '../AuthLayout'

export interface ForgotPasswordPageHeroProps extends AuthLayoutConfig { loginUrl?: string }

export default function ForgotPasswordPageHero({ loginUrl = '/login', logo, poweredBy, cardClassName, backgroundClass }: ForgotPasswordPageHeroProps) {
  const { email, error, isLoading, setEmail, handleSubmit } = useForgotPasswordFlow()
  return (
    <AuthLayout logo={logo} title="Forgot Password" subtitle="Enter your email and we'll send you a reset code" poweredBy={poweredBy} cardClassName={cardClassName} backgroundClass={backgroundClass}
      footer={<a href={loginUrl} className="text-sm text-gray-600 hover:text-gray-900 inline-flex items-center gap-1"><Icon icon="lucide:arrow-left" width={16} />Back to Login</a>}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <motion.div className="bg-red-50 text-red-600 border border-red-200 rounded-lg p-3 text-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{error}</motion.div>}
        <TextField type="email" value={email} onChange={setEmail} isRequired fullWidth>
          <Label className="text-gray-600">Email</Label>
          <Input className="bg-white" />
        </TextField>
        <Button type="submit" fullWidth size="lg" isPending={isLoading} className="h-12 font-semibold">
          {({ isPending }) => (<>{isPending && <Spinner color="current" size="sm" />}Send Reset Code</>)}
        </Button>
      </form>
    </AuthLayout>
  )
}