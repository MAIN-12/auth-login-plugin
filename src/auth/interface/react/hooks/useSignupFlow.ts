'use client'

import { useState } from 'react'
import { authRoute, useAuthNavigation, useAuthSearchParams } from '../AuthFlowContext'
import { useAuthService } from '../AuthServiceContext'
import { useAuthConfig } from '../providers/AuthConfigProvider'

/** Existing signup continuation: prove ownership before establishing a password. */
export function useSignupFlow(locale?: string) {
  const config = useAuthConfig()
  const service = useAuthService(locale)
  const params = useAuthSearchParams()
  const navigation = useAuthNavigation()
  const redirectTo = params.get('redirect') || '/'
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(() =>
    params.get('reason') === 'proof-expired' ? 'proofExpired' : null,
  )
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      const sent = await service.sendOwnership(email, 'signup')
      if (!sent.success) throw new Error(sent.code)
      navigation.push(
        authRoute(
          config.authBasePath,
          'verify-otp',
          {
            email,
            purpose: 'signup',
            context: sent.context,
            retryAfter: sent.retryAfter,
          },
          redirectTo,
        ),
      )
    } catch {
      setError('error')
    } finally {
      setIsLoading(false)
    }
  }
  return {
    email,
    setEmail,
    isLoading,
    error,
    handleSubmit,
    handleGoogleLogin: () => service.loginGoogle(redirectTo),
  }
}
