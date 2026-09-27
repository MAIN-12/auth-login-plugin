'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useAuthNavigation } from '../AuthFlowContext'
import { verifyOtp, sendOtp } from '../services/authService'
import { pluginConfig } from '../../../config'

export interface UseVerifyOtpFlowOptions {
  email: string
  purpose: 'login' | 'signup' | 'password-reset'
  redirectTo?: string
}

/**
 * State machine for OTP verification: input → verify → redirect | resend.
 */
export function useVerifyOtpFlow({ email, purpose, redirectTo = '/' }: UseVerifyOtpFlowOptions) {
  const router = useAuthNavigation()

  const [otp, setOtp] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isResending, setIsResending] = useState(false)
  // Start with 30s cooldown since a code was just sent before arriving here
  const [resendCooldown, setResendCooldown] = useState(30)

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
        const { passwordLogin: passwordLoginEnabled, otpLogin: otpLoginEnabled } = pluginConfig

        if (purpose === 'password-reset') {
          // Always allow setting password from explicit password-reset flow
          router.push(`/set-password?redirect=${encodeURIComponent(redirectTo)}`)
        } else if (!otpLoginEnabled && passwordLoginEnabled && data.isNewUser) {
          // Only prompt for password if OTP login is disabled and password login is enabled
          router.push(`/set-password?redirect=${encodeURIComponent(redirectTo)}`)
        } else {
          // OTP login is enabled — go straight to the app
          await router.complete(redirectTo)
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

  // Auto-verify when all 6 digits are entered
  useEffect(() => {
    if (otp.length === 6 && !isLoading) {
      handleSubmit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp])

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