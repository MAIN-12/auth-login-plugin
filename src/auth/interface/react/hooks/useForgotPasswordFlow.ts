'use client'

import { useState, useCallback, useRef } from 'react'
import { useAuthSearchParams, useAuthNavigation, authRoute } from '../AuthFlowContext'
import { createAuthService } from '../../client/authService'
import { useAuthConfig } from '../../../../components/AuthConfigContext'

/**
 * Forgot password flow: enter email → request generic ownership verification → redirect to verify-otp.
 */
export function useForgotPasswordFlow(locale?: string) {
  const router = useAuthNavigation()
  const config = useAuthConfig()
  const params = useAuthSearchParams()

  const inFlight = useRef(false)
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(() =>
    params.get('reason') === 'proof-expired' ? 'proofExpired' : null,
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (inFlight.current || !email.trim()) return
      inFlight.current = true
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
        inFlight.current = false
        setIsLoading(false)
      }
    },
    [email, router, config, params, locale],
  )

  return { email, error, isLoading, setEmail, handleSubmit }
}
