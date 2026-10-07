'use client'

import { useState, useCallback } from 'react'
import { useAuthSearchParams, useAuthNavigation, authRoute } from '../AuthFlowContext'
import { createAuthService } from '../services/authService'
import { useAuthConfig } from '../../../components/AuthConfigContext'

/**
 * Forgot password flow: enter email → check exists → send OTP → redirect to verify-otp.
 */
export function useForgotPasswordFlow(locale?: string) {
  const router = useAuthNavigation()
  const config = useAuthConfig()
  const params = useAuthSearchParams()

  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(() =>
    params.get('reason') === 'proof-expired' ? 'proofExpired' : null,
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!email.trim()) return
      setIsLoading(true)
      setError(null)

      try {
        const data = await createAuthService(config, locale).sendOwnership(email, 'recovery')
        if (data.success) {
          router.push(
            authRoute(
              config.authBasePath,
              'verify-otp',
              {
                email: email.trim(),
                purpose: 'password-reset',
                context: data.context,
                retryAfter: data.retryAfter,
              },
              params.get('redirect') ?? '/',
            ),
          )
        } else {
          setError(data.message || 'error')
        }
      } catch {
        setError('error')
      } finally {
        setIsLoading(false)
      }
    },
    [email, router, config, params, locale],
  )

  return { email, error, isLoading, setEmail, handleSubmit }
}
