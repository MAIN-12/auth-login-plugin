// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { AuthConfigProvider } from '../src/components/AuthConfigContext'
import { AuthFlowContext } from '../src/auth/application/AuthFlowContext'
import { SetPasswordForm } from '../src/components/forms/SetPasswordForm'
import { storePasswordProof, readPasswordProof } from '../src/auth/application/services/passwordProof'
import { publicConfig } from './auth-test-config'
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }))
let root: Root
let host: HTMLDivElement
const push = vi.fn()
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks()
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  sessionStorage.clear()
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); sessionStorage.clear() })
async function mount(purpose: 'signup' | 'recovery' | 'reauth', lifetime = 1000) {
  storePasswordProof(publicConfig, { purpose, permit: 'opaque-proof', expiresAt: Date.now() + lifetime })
  await act(async () => root.render(<AuthConfigProvider publicConfig={publicConfig}><AuthFlowContext.Provider value={{ push, complete: async () => {}, searchParams: new URLSearchParams() }}><SetPasswordForm locale="en" /></AuthFlowContext.Provider></AuthConfigProvider>))
}
async function submit() {
  await act(async () => {
    for (const input of host.querySelectorAll<HTMLInputElement>('input')) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'the river carries quiet dreams')
      input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }))
    }
  })
  await act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
}
it('a mounted expired recovery continuation clears and returns to requesting a new recovery code', async () => {
  await mount('recovery')
  expect(host.textContent).toContain('New Password')
  await act(async () => { vi.advanceTimersByTime(1001) })
  expect(push).toHaveBeenCalledWith(`${publicConfig.authBasePath}/forgot-password?reason=proof-expired`)
  expect(readPasswordProof(publicConfig)).toBeNull()
})
it('server rejection of a consumed signup continuation restarts signup instead of stranding its owner', async () => {
  await mount('signup', 600000)
  vi.mocked(fetch).mockResolvedValue(Response.json({ success: false, code: 'AUTH_FAILED' }, { status: 401 }))
  await submit()
  expect(push).toHaveBeenCalledWith(`${publicConfig.authBasePath}/signup?reason=proof-expired`)
  expect(readPasswordProof(publicConfig)).toBeNull()
})
it('transient unavailable storage preserves the limited proof and editable password for retry', async () => {
  await mount('recovery', 600000)
  vi.mocked(fetch).mockResolvedValue(Response.json({ success: false, code: 'AUTH_UNAVAILABLE' }, { status: 503 }))
  await submit()
  expect(push).not.toHaveBeenCalled()
  expect(readPasswordProof(publicConfig)?.permit).toBe('opaque-proof')
  expect(host.querySelector('form')).toBeTruthy()
})
it('an expired mounted reauthentication proof returns to identity verification without navigating anonymously', async () => {
  await mount('reauth')
  await act(async () => { vi.advanceTimersByTime(1001) })
  expect(push).not.toHaveBeenCalled()
  expect(readPasswordProof(publicConfig)).toBeNull()
  expect(host.textContent).toContain('Current password')
  expect(host.textContent).toContain('Reauthenticate')
})
it('server password validation errors preserve the valid proof for correction instead of restarting verification', async () => {
  await mount('recovery', 600000)
  vi.mocked(fetch).mockResolvedValue(Response.json({ success: false, code: 'INVALID_INPUT' }, { status: 400 }))
  await submit()
  expect(push).not.toHaveBeenCalled()
  expect(readPasswordProof(publicConfig)?.permit).toBe('opaque-proof')
  expect(host.querySelector('form')).toBeTruthy()
})
