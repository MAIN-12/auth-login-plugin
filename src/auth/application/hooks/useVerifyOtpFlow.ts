'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useAuthNavigation } from '../AuthFlowContext'
import { createAuthService } from '../services/authService'
import { storePasswordProof } from '../services/passwordProof'
import { useAuthConfig } from '../../../components/AuthConfigContext'

export interface UseVerifyOtpFlowOptions {
  email: string
  purpose: 'login' | 'signup' | 'password-reset' | 'reauth'
  redirectTo?: string
  context: string
  retryAfter?: number
}

/**
 * State machine for OTP verification: input → verify → redirect | resend.
 */
export function useVerifyOtpFlow({ email, purpose, context, retryAfter = 0, redirectTo = '/' }: UseVerifyOtpFlowOptions) {
  const pluginConfig = useAuthConfig()
  const router = useAuthNavigation()

  const submitting = useRef(false)
  const [otp, setOtp] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isResending, setIsResending] = useState(false)
  // Cooldown comes from the server contract, never grants permission locally.
  const [resendCooldown, setResendCooldown] = useState(Math.max(0, retryAfter))

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const handleSubmit = useCallback(async () => {
    if (otp.length !== 6 || submitting.current) return
    submitting.current = true
    setIsLoading(true)
    setError(null)
    try {
      if (purpose !== 'login') {
        const proof = await createAuthService(pluginConfig).verifyOwnership(email, purpose === 'password-reset' ? 'recovery' : purpose, otp, context)
        storePasswordProof(pluginConfig, { ...proof, purpose: purpose === 'password-reset' ? 'recovery' : purpose })
        router.push(`${pluginConfig.authBasePath}/set-password`)
        return
      }
      const data = await createAuthService(pluginConfig).verifyOtp(email, otp, context)
      if (data.success) {
        await router.complete(redirectTo)

      } else {
        setError(data.error || 'error')
        setOtp('')
      }
    } catch {
      setError('error')
      setOtp('')
    } finally {
      submitting.current = false
      setIsLoading(false)
    }
  }, [otp, email, purpose, redirectTo, router, pluginConfig, context])

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
      const service = createAuthService(pluginConfig)
      const data = await (purpose === 'login' ? service.sendOtp(email, context) : service.sendOwnership(email, purpose === 'password-reset' ? 'recovery' : purpose, context))
      if (data.success) {
        setResendCooldown(data.retryAfter ?? 0)
      } else {
        setError(data.message || 'resendError')
      }
    } catch {
      setError('resendError')
    } finally {
      setIsResending(false)
    }
  }, [email, purpose, resendCooldown, pluginConfig, context])

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