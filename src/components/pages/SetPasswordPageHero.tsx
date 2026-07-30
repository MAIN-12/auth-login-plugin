'use client'

import React from 'react'
import { Button, Input } from '@heroui/react'
import { Icon } from '@iconify/react'
import { motion } from 'framer-motion'
import { useSetPasswordFlow } from '../../auth/application/hooks/useSetPasswordFlow.js'
import { AuthLayout } from '../AuthLayout.js'
import type { AuthLayoutConfig } from '../AuthLayout.js'

export interface SetPasswordPageHeroProps extends AuthLayoutConfig { redirectTo?: string }

export default function SetPasswordPageHero({ redirectTo = '/', logo, poweredBy, cardClassName, backgroundClass }: SetPasswordPageHeroProps) {
  const { password, confirmPassword, error, isLoading, showPassword, strength, setPassword, setConfirmPassword, setShowPassword, handleSubmit } = useSetPasswordFlow({ redirectTo })
  const bars = Array.from({ length: 5 }, (_, i) => i < strength.score)

  return (
    <AuthLayout logo={logo} title="Set Your Password" subtitle="Create a secure password for your account" poweredBy={poweredBy} cardClassName={cardClassName} backgroundClass={backgroundClass}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <motion.div className="bg-red-50 text-red-600 border border-red-200 rounded-lg p-3 text-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{error}</motion.div>}
        <Input type={showPassword ? 'text' : 'password'} label="New Password" value={password} onValueChange={setPassword} variant="bordered" size="lg" isRequired autoFocus
          classNames={{ input: 'text-gray-900', label: 'text-gray-600', inputWrapper: 'border-gray-300 bg-white' }}
          endContent={<button type="button" onClick={() => setShowPassword(!showPassword)}><Icon icon={showPassword ? 'lucide:eye-off' : 'lucide:eye'} className="text-gray-400" width={20} /></button>} />
        {password.length > 0 && <div className="flex gap-1">{bars.map((a, i) => <div key={i} className={`h-1 flex-1 rounded-full ${a ? 'bg-[#D5E855]' : 'bg-gray-200'}`} />)}</div>}
        <Input type={showPassword ? 'text' : 'password'} label="Confirm Password" value={confirmPassword} onValueChange={setConfirmPassword} variant="bordered" size="lg" isRequired
          classNames={{ input: 'text-gray-900', label: 'text-gray-600', inputWrapper: 'border-gray-300 bg-white' }} />
        <Button type="submit" fullWidth size="lg" color="primary" isLoading={isLoading} className="h-12 font-semibold">Set Password</Button>
      </form>
    </AuthLayout>
  )
}