'use client'

import { useState, useCallback } from 'react'
import { useAuthNavigation } from '../AuthFlowContext'
import type { LoginStep } from '../../domain/types'
import { sendOtp, initiateGoogleLogin } from '../services/authService'
import { useAuthConfig } from '../../../components/AuthConfigContext'

export interface UseLoginFlowOptions {
  redirectTo: string
  /** Called after successful password login with { email, password } */
  onPasswordLogin: (credentials: { email: string; password: string }) => Promise<void>
}

/**
 * State machine for the multi-step login flow: email → password | otp-prompt.
 * The page component owns the UI; this hook owns the logic.
 */
export function useLoginFlow({ redirectTo, onPasswordLogin }: UseLoginFlowOptions) {
  const config = useAuthConfig()
  const router = useAuthNavigation()

  const [step, setStep] = useState<LoginStep>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [isSendingOtp, setIsSendingOtp] = useState(false)

  const handleEmailSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!email.trim()) return
      setIsLoading(true)
      setError(null)

      try {
        // Public UI chooses an enabled method, never queries account capabilities.
        if (!config.passwordLogin) throw new Error('Login method unavailable')
        setStep('password')
      } catch {
        setError('genericError')
      } finally {
        setIsLoading(false)
      }
    },
    [email, config.passwordLogin],
  )

  const handlePasswordSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setIsLoading(true)
      setError(null)
      try {
        await onPasswordLogin({ email, password })
        await router.complete(redirectTo)
      } catch {
        setError('error')
      } finally {
        setIsLoading(false)
      }
    },
    [email, password, onPasswordLogin, redirectTo, router],
  )

  const handleSendOtp = useCallback(async () => {
    setIsSendingOtp(true)
    setError(null)
    try {
      const data = await sendOtp(email, 'login')
      if (data.success) {
        const redirectParam = redirectTo !== '/' ? `&redirect=${encodeURIComponent(redirectTo)}` : ''
        router.push(`/verify-otp?email=${encodeURIComponent(email.trim())}${redirectParam}`)
      } else {
        setError(data.message || 'otpSendFailed')
      }
    } catch {
      setError('otpSendFailed')
    } finally {
      setIsSendingOtp(false)
    }
  }, [email, redirectTo, router])

  const handleEditEmail = useCallback(() => {
    setStep('email')
    setError(null)
  }, [])

  const handleGoogleLogin = useCallback(() => {
    if (config.googleOAuthEnabled) initiateGoogleLogin(redirectTo)
  }, [redirectTo, config.googleOAuthEnabled])

  return {
    step,
    email,
    password,
    error,
    isLoading,
    isSendingOtp,
    showPassword,
    setEmail,
    setPassword,
    setShowPassword,
    handleEmailSubmit,
    handlePasswordSubmit,
    handleSendOtp,
    handleEditEmail,
    handleGoogleLogin,
  }
}