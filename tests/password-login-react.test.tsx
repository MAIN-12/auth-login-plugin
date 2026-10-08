// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { publicConfig } from './auth-test-config'
import { AuthConfigProvider } from '../src/components/AuthConfigContext'
import { AuthFlowContext } from '../src/auth/interface/react/AuthFlowContext'
import { useLoginFlow } from '../src/auth/interface/react/hooks/useLoginFlow'
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
it('coalesces simultaneous password submits and allows a new attempt after failure', async () => {
  const host = document.createElement('div')
  const root = createRoot(host)
  let reject!: (error: Error) => void
  const login = vi.fn(
    () =>
      new Promise<void>((_, fail) => {
        reject = fail
      }),
  )
  const complete = vi.fn()
  const fetch = vi.fn(async () =>
    Response.json({ success: true, context: 'a'.repeat(64), retryAfter: 30 }),
  )
  vi.stubGlobal('fetch', fetch)
  let flow!: ReturnType<typeof useLoginFlow>
  function Probe() {
    flow = useLoginFlow({ redirectTo: '/checkout', onPasswordLogin: login, locale: 'es' })
    return null
  }
  try {
    await act(async () =>
      root.render(
        <AuthConfigProvider publicConfig={{ ...publicConfig, otpLogin: true }}>
          <AuthFlowContext.Provider
            value={{ push: vi.fn(), complete, searchParams: new URLSearchParams() }}
          >
            <Probe />
          </AuthFlowContext.Provider>
        </AuthConfigProvider>,
      ),
    )
    await act(async () => {
      flow.setEmail('a@b.test')
      flow.setPassword('x')
    })
    const event = { preventDefault: vi.fn() } as unknown as React.FormEvent
    let pending!: Promise<void>
    await act(async () => {
      pending = flow.handlePasswordSubmit(event)
      void flow.handlePasswordSubmit(event)
    })
    expect(login).toHaveBeenCalledTimes(1)
    await act(async () => {
      await flow.handleSendOtp()
    })
    expect(fetch).not.toHaveBeenCalled()
    await act(async () => {
      reject(new Error('private'))
      await pending
    })
    expect(complete).not.toHaveBeenCalled()
    expect(flow.error).toBe('genericError')
    await act(async () => {
      pending = flow.handlePasswordSubmit(event)
    })
    expect(login).toHaveBeenCalledTimes(2)
    await act(async () => {
      reject(new Error('again'))
      await pending
    })
  } finally {
    await act(async () => root.unmount())
    vi.unstubAllGlobals()
  }
})
