'use client'

import { useEmailField } from './useEmailField'

import { useState } from 'react'
import { authRoute, useAuthNavigation, useAuthSearchParams } from '../AuthFlowContext'
import { useAuthService } from '../AuthServiceContext'
import { useAuthConfig } from '../providers/AuthConfigProvider/index'

/** Existing signup continuation: prove ownership before establishing a password. */
export function useSignupFlow(locale?: string) {
  const config = useAuthConfig()
  const service = useAuthService(locale)
  const params = useAuthSearchParams()
  const navigation = useAuthNavigation()
  const redirectTo = params.get('redirect') || '/'
  const { email, setEmail: updateEmail, emailError, isEmailValid } = useEmailField()
  const setEmail = (value: string) => {
    updateEmail(value)
    setError(null)
  }
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(() =>
    params.get('reason') === 'proof-expired' ? 'proofExpired' : null,
  )
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return
    if (!isEmailValid) {
      setError('invalidEmail')
      return
    }
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
  const handleGoogleLogin = async () => {
    if (isLoading || !config.googleOAuthEnabled) return
    if (!navigation.popup) {
      service.loginGoogle(redirectTo)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      await service.loginGooglePopup(redirectTo)
      await navigation.complete(redirectTo)
    } catch {
      setError('genericError')
    } finally {
      setIsLoading(false)
    }
  }
  return {
    email,
    isEmailValid,
    emailError,
    setEmail,
    isLoading,
    error,
    handleSubmit,
    handleGoogleLogin,
  }
}
