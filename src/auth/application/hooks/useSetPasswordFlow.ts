'use client'
import { useState, useCallback, useEffect } from 'react'
import { useAuthNavigation } from '../AuthFlowContext'
import { AuthRequestError, createAuthService } from '../services/authService'
import { readPasswordProof, storePasswordProof, type ClientPasswordProof } from '../services/passwordProof'
import { useAuthConfig } from '../../../components/AuthConfigContext'
import { evaluatePasswordStrength } from '../../domain/passwordRules'
export interface UseSetPasswordFlowOptions { redirectTo?: string }
/** Proof is merely a continuation; the server validates expiry, session, method and single use. */
export function useSetPasswordFlow({ redirectTo = '/' }: UseSetPasswordFlowOptions = {}) {
  const router = useAuthNavigation()
  const config = useAuthConfig()
  const [proof, setProof] = useState<ClientPasswordProof | null>(null)
  useEffect(() => { setProof(readPasswordProof(config)) }, [config])
  const [password, setPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const strength = evaluatePasswordStrength(password)
  const restartProof = useCallback((expired: ClientPasswordProof) => {
    storePasswordProof(config, null); setProof(null); setPassword(''); setConfirmPassword(''); setError('proofExpired')
    if (expired.purpose !== 'reauth') router.push(`${config.authBasePath}/${expired.purpose === 'signup' ? 'signup' : 'forgot-password'}?reason=proof-expired`)
  }, [config, router])
  useEffect(() => {
    if (!proof) return
    const timer = setTimeout(() => restartProof(proof), Math.max(0, proof.expiresAt - Date.now()))
    return () => clearTimeout(timer)
  }, [proof, restartProof])
  const handleReauthenticate = useCallback(async () => {
    setIsLoading(true); setError(null)
    try {
      const granted = await createAuthService(config).reauthenticate(currentPassword)
      const continuation = { ...granted, purpose: 'reauth' as const }
      storePasswordProof(config, continuation); setProof(continuation); setCurrentPassword('')
    } catch { setError('error') } finally { setIsLoading(false) }
  }, [config, currentPassword])
  const handleOtpReauthenticate = useCallback(async () => {
    setIsLoading(true); setError(null)
    try {
      const service = createAuthService(config)
      const user = await service.principal()
      const sent = await service.sendOwnership(user.email, 'reauth')
      router.push(`${config.authBasePath}/verify-otp?email=${encodeURIComponent(user.email)}&purpose=reauth&context=${sent.context}&retryAfter=${sent.retryAfter}`)
    } catch { setError('error') } finally { setIsLoading(false) }
  }, [config, router])
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault(); setError(null)
    if (!proof) { setError('proofExpired'); return }
    if (proof.expiresAt <= Date.now()) { restartProof(proof); return }
    if (password !== confirmPassword) { setError('passwordMismatch'); return }
    if (!strength.isValid) { setError('passwordTooWeak'); return }
    setIsLoading(true)
    try {
      await createAuthService(config).completePassword(proof, password)
      storePasswordProof(config, null); setProof(null); setPassword(''); setConfirmPassword('')
      if (proof.purpose === 'reauth') await router.complete(redirectTo)
      else router.push(`${config.authBasePath}/login`)
    } catch (failure) {
      if (failure instanceof AuthRequestError && failure.code === 'AUTH_FAILED') restartProof(proof)
      else setError('error')
    } finally { setIsLoading(false) }
  }, [proof, password, confirmPassword, strength.isValid, config, router, redirectTo, restartProof])
  return { password, confirmPassword, currentPassword, requiresReauthentication: !proof, error, isLoading, showPassword, strength, setPassword, setConfirmPassword, setCurrentPassword, setShowPassword, handleSubmit, handleReauthenticate, handleOtpReauthenticate }
}
