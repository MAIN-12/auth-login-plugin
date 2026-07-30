'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { sendOtp, checkEmail } from '../services/authService'

/**
 * Forgot password flow: enter email → check exists → send OTP → redirect to verify-otp.
 */
export function useForgotPasswordFlow() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!email.trim()) return
      setIsLoading(true)
      setError(null)

      try {
        const check = await checkEmail(email)
        if (!check.exists) {
          setError('noAccountFound')
          return
        }

        const data = await sendOtp(email, 'password-reset')
        if (data.success) {
          router.push(
            `/verify-otp?email=${encodeURIComponent(email.trim())}&purpose=password-reset`,
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
    [email, router],
  )

  return { email, error, isLoading, setEmail, handleSubmit }
}