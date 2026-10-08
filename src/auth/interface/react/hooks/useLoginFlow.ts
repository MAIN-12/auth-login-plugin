'use client'

import { useState, useCallback, useRef } from 'react'
import { useAuthNavigation, authRoute } from '../AuthFlowContext'
import type { LoginStep } from '../../../domain/types'
import { authErrorKey, createAuthService, initiateGoogleLogin } from '../../client/authService'
import { useAuthConfig } from '../../../../components/AuthConfigContext'

export interface UseLoginFlowOptions {
  locale?: string
  redirectTo: string
  /** Called after successful password login with { email, password } */
  onPasswordLogin: (credentials: { email: string; password: string }) => Promise<void>
}

/**
 * State machine for the multi-step login flow: email → password | otp-prompt.
 * The page component owns the UI; this hook owns the logic.
 */
export function useLoginFlow({ redirectTo, onPasswordLogin, locale }: UseLoginFlowOptions) {
  const config = useAuthConfig()
  const router = useAuthNavigation()
  const inFlight = useRef(false)

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
        setStep(config.passwordLogin ? 'password' : 'otp-prompt')
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
      if (!config.passwordLogin || inFlight.current) return
      inFlight.current = true
      setIsLoading(true)
      setError(null)
      try {
        await onPasswordLogin({ email, password })
        await router.complete(redirectTo)
      } catch (failure) {
        setError(authErrorKey(failure))
      } finally {
        inFlight.current = false
        setIsLoading(false)
      }
    },
    [config.passwordLogin, email, password, onPasswordLogin, redirectTo, router],
  )

  const handleSendOtp = useCallback(async () => {
    if (!config.otpLogin || inFlight.current) return
    inFlight.current = true
    setIsSendingOtp(true)
    setError(null)
    try {
      const data = await createAuthService(config, locale).sendOtp(email)
      if (data.success) {
        router.push(
          authRoute(
            config.authBasePath,
            'verify-otp',
            { email: email.trim(), context: data.context, retryAfter: data.retryAfter },
            redirectTo,
          ),
        )
      } else {
        setError(data.message || 'otpSendFailed')
      }
    } catch {
      setError('otpSendFailed')
    } finally {
      inFlight.current = false
      setIsSendingOtp(false)
    }
  }, [email, redirectTo, router, config, locale])

  const handleEditEmail = useCallback(() => {
    if (inFlight.current) return
    setStep('email')
    setError(null)
  }, [])

  const handleGoogleLogin = useCallback(() => {
    if (!inFlight.current && config.googleOAuthEnabled) initiateGoogleLogin(redirectTo, config)
  }, [redirectTo, config])

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
