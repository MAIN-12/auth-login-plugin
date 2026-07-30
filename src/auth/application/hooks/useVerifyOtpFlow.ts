'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { verifyOtp, sendOtp } from '../services/authService.js'

export interface UseVerifyOtpFlowOptions {
  email: string
  purpose: 'login' | 'signup' | 'password-reset'
  redirectTo?: string
}

/**
 * State machine for OTP verification: input → verify → redirect | resend.
 */
export function useVerifyOtpFlow({ email, purpose, redirectTo = '/' }: UseVerifyOtpFlowOptions) {
  const router = useRouter()

  const [otp, setOtp] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isResending, setIsResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const handleSubmit = useCallback(async () => {
    if (otp.length !== 6) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await verifyOtp(email, otp)
      if (data.success) {
        if (purpose === 'password-reset') {
          router.push(`/set-password?redirect=${encodeURIComponent(redirectTo)}`)
        } else if (data.isNewUser) {
          router.push(`/set-password?redirect=${encodeURIComponent(redirectTo)}`)
        } else {
          window.location.href = redirectTo
        }
      } else {
        setError(data.error || 'error')
        setOtp('')
      }
    } catch {
      setError('error')
      setOtp('')
    } finally {
      setIsLoading(false)
    }
  }, [otp, email, purpose, redirectTo, router])

  const handleResendCode = useCallback(async () => {
    if (resendCooldown > 0) return
    setIsResending(true)
    setError(null)
    try {
      const data = await sendOtp(email, purpose)
      if (data.success) {
        setResendCooldown(60)
      } else {
        setError(data.message || 'resendError')
      }
    } catch {
      setError('resendError')
    } finally {
      setIsResending(false)
    }
  }, [email, purpose, resendCooldown])

  return {
    otp,
    error,
    isLoading,
    isResending,
    resendCooldown,
    setOtp,
    handleSubmit,
    handleResendCode,
  }
}