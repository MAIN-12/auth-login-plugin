'use client'

import { useState, useCallback } from 'react'
import { useAuthSearchParams, useAuthNavigation } from '../AuthFlowContext'
import { createAuthService } from '../services/authService'
import { useAuthConfig } from '../../../components/AuthConfigContext'

/**
 * Forgot password flow: enter email → check exists → send OTP → redirect to verify-otp.
 */
export function useForgotPasswordFlow() {
  const router = useAuthNavigation()
  const config = useAuthConfig()
  const params = useAuthSearchParams()

  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(() => params.get('reason') === 'proof-expired' ? 'proofExpired' : null)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!email.trim()) return
      setIsLoading(true)
      setError(null)

      try {
        const data = await createAuthService(config).sendOwnership(email, 'recovery')
        if (data.success) {
          router.push(
            `${config.authBasePath}/verify-otp?email=${encodeURIComponent(email.trim())}&purpose=password-reset&context=${encodeURIComponent(data.context ?? '')}&retryAfter=${data.retryAfter ?? 0}`,
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
    [email, router, config],
  )

  return { email, error, isLoading, setEmail, handleSubmit }
}