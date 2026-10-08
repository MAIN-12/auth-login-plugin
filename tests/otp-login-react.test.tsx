// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { publicConfig } from './auth-test-config'
import { AuthConfigProvider } from '../src/auth/interface/react/providers/AuthConfigProvider'
import { AuthFlowContext } from '../src/auth/interface/react/AuthFlowContext'
import { useVerifyOtpFlow } from '../src/auth/interface/react/hooks/useVerifyOtpFlow'
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
it('verification and resend share one in-flight operation and allow retry after expired authority', async () => {
  const root = createRoot(document.createElement('div'))
  let resolve!: (response: Response) => void
  const fetch = vi.fn(
    () =>
      new Promise<Response>((done) => {
        resolve = done
      }),
  )
  vi.stubGlobal('fetch', fetch)
  const complete = vi.fn()
  const push = vi.fn()
  let flow!: ReturnType<typeof useVerifyOtpFlow>
  function Probe() {
    flow = useVerifyOtpFlow({
      email: 'user@example.com',
      purpose: 'login',
      context: 'a'.repeat(64),
      locale: 'es',
      redirectTo: '/checkout',
    })
    return null
  }
  try {
    await act(async () =>
      root.render(
        <AuthConfigProvider publicConfig={{ ...publicConfig, otpLogin: true }}>
          <AuthFlowContext.Provider value={{ complete, push, searchParams: new URLSearchParams() }}>
            <Probe />
          </AuthFlowContext.Provider>
        </AuthConfigProvider>,
      ),
    )
    await act(async () => {
      flow.setOtp('123456')
    })
    expect(fetch).toHaveBeenCalledTimes(1)
    await act(async () => {
      await flow.handleSubmit()
      await flow.handleResendCode()
    })
    expect(fetch).toHaveBeenCalledTimes(1)
    await act(async () => {
      resolve(Response.json({ success: true, user: { id: 'A' }, exp: 1 }))
      await Promise.resolve()
    })
    expect(complete).not.toHaveBeenCalled()
    expect(flow.error).toBe('error')
    expect(flow.otp).toBe('')
    await act(async () => {
      flow.setOtp('654321')
    })
    expect(fetch).toHaveBeenCalledTimes(2)
    const [, init] = fetch.mock.calls[1] as unknown as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toEqual({
      email: 'user@example.com',
      purpose: 'login',
      otp: '654321',
      context: 'a'.repeat(64),
    })
    expect(init.headers).toMatchObject({ 'Accept-Language': 'es' })
    await act(async () => {
      resolve(
        Response.json({
          success: true,
          user: { id: 'A' },
          exp: Math.floor(Date.now() / 1000) + 900,
        }),
      )
      await Promise.resolve()
    })
    expect(complete).toHaveBeenCalledWith('/checkout')
    expect(push).not.toHaveBeenCalled()
  } finally {
    await act(async () => root.unmount())
    vi.unstubAllGlobals()
  }
})
