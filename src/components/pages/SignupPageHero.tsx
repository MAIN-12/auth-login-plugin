'use client'

import React from 'react'
import { Button, Input, Divider } from '@heroui/react'
import { Icon } from '@iconify/react'
import { motion } from 'framer-motion'
import { AuthLayout } from '../AuthLayout.js'
import type { AuthLayoutConfig } from '../AuthLayout.js'

export interface SignupPageHeroProps extends AuthLayoutConfig {
  onSignup: (data: { name: string; email: string }) => Promise<void>
  showGoogleOAuth?: boolean
  loginUrl?: string
}

export default function SignupPageHero({ onSignup, showGoogleOAuth = true, loginUrl = '/login', logo, poweredBy, cardClassName, backgroundClass }: SignupPageHeroProps) {
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsLoading(true); setError(null)
    try { await onSignup({ name, email }); window.location.href = `/verify-otp?email=${encodeURIComponent(email)}&purpose=signup` }
    catch (err: any) { setError(err.message || 'Signup failed') }
    finally { setIsLoading(false) }
  }

  return (
    <AuthLayout logo={logo} title="Create Account" subtitle="Enter your details to get started" poweredBy={poweredBy} cardClassName={cardClassName} backgroundClass={backgroundClass}
      footer={<p className="text-center text-gray-600 text-sm">Already have an account? <a href={loginUrl} className="text-gray-900 font-medium hover:underline">Sign in</a></p>}>
      {showGoogleOAuth && (<>
        <Button fullWidth variant="bordered" size="lg" className="mb-4 h-12 border-gray-300 rounded-full text-gray-700 hover:bg-gray-50" startContent={<Icon icon="flat-color-icons:google" width={20} />}>Continue with Google</Button>
        <div className="flex items-center gap-4 my-4"><Divider className="flex-1" /><span className="text-gray-500 text-sm">or</span><Divider className="flex-1" /></div>
      </>)}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <motion.div className="bg-red-50 text-red-600 border border-red-200 rounded-lg p-3 text-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{error}</motion.div>}
        <Input type="text" label="Full Name" value={name} onValueChange={setName} variant="bordered" size="lg" isRequired classNames={{ input: 'text-gray-900', label: 'text-gray-600', inputWrapper: 'border-gray-300 bg-white' }} />
        <Input type="email" label="Email" value={email} onValueChange={setEmail} variant="bordered" size="lg" isRequired classNames={{ input: 'text-gray-900', label: 'text-gray-600', inputWrapper: 'border-gray-300 bg-white' }} />
        <p className="text-xs text-gray-600 text-center">By signing up, you agree to our <a href="/terms" className="text-gray-900 hover:underline">Terms</a> and <a href="/privacy" className="text-gray-900 hover:underline">Privacy</a></p>
        <Button type="submit" fullWidth size="lg" color="primary" isLoading={isLoading} className="h-12 font-semibold">Create Account</Button>
      </form>
    </AuthLayout>
  )
}