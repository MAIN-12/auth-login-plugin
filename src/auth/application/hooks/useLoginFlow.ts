'use client'

import { useState, useCallback } from 'react'
import { useAuthNavigation } from '../AuthFlowContext'
import type { LoginStep } from '../../domain/types'
import { checkEmail, sendOtp, initiateGoogleLogin } from '../services/authService'
import { pluginConfig } from '../../../config'

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
        const data = await checkEmail(email)
        if (!data.exists) {
          setError('noAccountFound')
          return
        }
        const { passwordLogin: passwordLoginEnabled, otpLogin: otpLoginEnabled } = pluginConfig

        if (data.hasPassword && passwordLoginEnabled) {
          // Show password step if user has a password and password login is enabled
          setStep('password')
          return
        }
        // OTP login — send OTP immediately and redirect to verify page
        const otpData = await sendOtp(email, 'login')
        if (otpData.success) {
          const redirectParam = redirectTo !== '/' ? `&redirect=${encodeURIComponent(redirectTo)}` : ''
          router.push(`/verify-otp?email=${encodeURIComponent(email.trim())}${redirectParam}`)
        } else {
          setError(otpData.message || 'otpSendFailed')
        }
      } catch {
        setError('genericError')
      } finally {
        setIsLoading(false)
      }
    },
    [email, redirectTo, router],
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
    initiateGoogleLogin(redirectTo)
  }, [redirectTo])

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