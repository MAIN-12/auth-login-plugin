// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthConfigProvider } from '../src/components/AuthConfigContext'
import { AuthFlowContext } from '../src/auth/application/AuthFlowContext'
import { VerifyOtpForm } from '../src/components/forms/VerifyOtpForm'
import { OtpInput } from '../src/components/ui/tailwind'
import { publicConfig } from './auth-test-config'
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const roots: ReturnType<typeof createRoot>[] = []
afterEach(async () => { for (const root of roots.splice(0)) await act(async () => root.unmount()); document.body.innerHTML = ''; vi.unstubAllGlobals() })
async function mount(element: React.ReactNode, params = '') {
 const host = document.createElement('div'); document.body.append(host); const root = createRoot(host); roots.push(root)
 await act(async () => root.render(<AuthConfigProvider publicConfig={{ ...publicConfig, authBasePath: '/members', otpLogin: true }}><AuthFlowContext.Provider value={{ push: vi.fn(), complete: async () => {}, searchParams: new URLSearchParams(params) }}>{element}</AuthFlowContext.Provider></AuthConfigProvider>))
 return host
}
it('an incomplete OTP link offers a localized recovery action rather than an empty screen', async () => {
 const host = await mount(<VerifyOtpForm locale="es" />)
 expect(host.textContent).toContain('Volver')
 expect(host.querySelector('a')?.getAttribute('href')).toBe('/members/login')
 expect(host.querySelector('input')).toBeNull()
})
it('deleting a middle OTP digit preserves every later position and remains editable', async () => {
 function Entry() { const [value, setValue] = React.useState('123456'); return <OtpInput value={value} onValueChange={setValue} /> }
 const host = await mount(<Entry />)
 const inputs = host.querySelectorAll<HTMLInputElement>('input')
 await act(async () => { inputs[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true })) })
 expect([...inputs].map(input => input.value)).toEqual(['1', '2', '', '4', '5', '6'])
})
it('autofill plus a simultaneous manual verify sends at most one HTTP request', async () => {
 let resolve!: (response: Response) => void
 const request = vi.fn(() => new Promise<Response>(done => { resolve = done }))
 vi.stubGlobal('fetch', request)
 const host = await mount(<VerifyOtpForm locale="en" />, `email=a%40example.test&context=${'a'.repeat(64)}`)
 const event = new Event('paste', { bubbles: true, cancelable: true })
 Object.defineProperty(event, 'clipboardData', { value: { getData: () => '123456' } })
 await act(async () => host.querySelector('input')!.dispatchEvent(event))
 await act(async () => host.querySelector('button')!.click())
 expect(request).toHaveBeenCalledTimes(1)
 await act(async () => resolve(Response.json({ success: true })))
})
import { AuthCard } from '../src/components/AuthCard'
it('responsive card presentation mounts only one live form tree', async () => {
 const host = await mount(<AuthCard><form><input aria-label="One live workflow" /></form></AuthCard>)
 expect(host.querySelectorAll('form')).toHaveLength(1)
})
import { getFormBySlug, LoginForm } from '../src/components/forms'
it('unrecognized or inherited form names recover to the login form', () => {
 expect(getFormBySlug('__proto__')).toBe(LoginForm)
 expect(getFormBySlug('constructor')).toBe(LoginForm)
})
import { Button as HeroButton } from '../src/components/ui/hero'
it('HeroUI primary actions have a scoped high-contrast default independent of the host theme', async () => {
 const host = await mount(<HeroButton variant="primary">Continue</HeroButton>)
 const button = host.querySelector('button')!
 expect(button.style.backgroundColor).toMatch(/^(#d5e855|rgb\(213, 232, 85\))$/i)
 expect(button.style.color).toMatch(/^(#1d1d1f|rgb\(29, 29, 31\))$/i)
})
