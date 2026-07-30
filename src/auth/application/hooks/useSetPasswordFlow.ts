'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { setUserPassword } from '../services/authService'
import { evaluatePasswordStrength } from '../../domain/passwordRules'

export interface UseSetPasswordFlowOptions {
  redirectTo?: string
}

/**
 * Set password flow: enter new password + confirm → validate → submit.
 */
export function useSetPasswordFlow({ redirectTo = '/' }: UseSetPasswordFlowOptions = {}) {
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const strength = evaluatePasswordStrength(password)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)

      if (password !== confirmPassword) {
        setError('passwordMismatch')
        return
      }
      if (!strength.isValid) {
        setError('passwordTooWeak')
        return
      }

      setIsLoading(true)
      try {
        const data = await setUserPassword(password, confirmPassword)
        if (data.success) {
          window.location.href = redirectTo
        } else {
          setError(data.message || 'error')
        }
      } catch {
        setError('error')
      } finally {
        setIsLoading(false)
      }
    },
    [password, confirmPassword, strength.isValid, redirectTo, router],
  )

  return {
    password,
    confirmPassword,
    error,
    isLoading,
    showPassword,
    strength,
    setPassword,
    setConfirmPassword,
    setShowPassword,
    handleSubmit,
  }
}