// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import * as client from '../src/exports/client'
import { publicConfig } from './auth-test-config'
import { AuthConfigProvider } from '../src/components/AuthConfigContext'
import { AuthFlowContext } from '../src/auth/application/AuthFlowContext'
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const roots: ReturnType<typeof createRoot>[] = []
const push = vi.fn()
afterEach(async () => { for (const root of roots.splice(0)) await act(async () => root.unmount()); document.body.innerHTML = ''; sessionStorage.clear(); vi.unstubAllGlobals(); vi.clearAllMocks(); vi.restoreAllMocks(); vi.useRealTimers() })
async function mount(element: React.ReactNode, search = '', signup = false) {
 const host = document.createElement('div'); document.body.append(host); const root = createRoot(host); roots.push(root)
 await act(async () => root.render(<AuthConfigProvider publicConfig={{ ...publicConfig, authBasePath: '/members', otpLogin: true, allowSignup: signup }}><AuthFlowContext.Provider value={{ push, complete: async () => {}, searchParams: new URLSearchParams(search) }}>{element}</AuthFlowContext.Provider></AuthConfigProvider>))
 await vi.waitFor(async () => { await act(async () => { await Promise.resolve() }); expect(host.querySelector('[role="status"]')).toBeNull() })
 return host
}
it('the public client export consistently exposes typed method and popup failures', async () => {
 expect('AuthRequestError' in client).toBe(true)
 const service = client.createAuthService(publicConfig)
 await Promise.all([service.sendOtp('a@example.test'), service.verifyOtp('a@example.test', '123456', 'a'.repeat(64)), service.linkGoogle('opaque'), service.reauthenticateGoogle()].map(result => expect(result).rejects.toMatchObject({ code: 'METHOD_DISABLED', status: 403 })))
 expect(() => client.initiateGoogleLogin('/', publicConfig)).toThrow(client.AuthRequestError)
 vi.spyOn(window, 'open').mockReturnValue(null)
 await expect(client.createAuthService({ ...publicConfig, googleOAuthEnabled: true }).reauthenticateGoogle()).rejects.toMatchObject({ code: 'AUTH_UNAVAILABLE', status: 503 })
})
it('closed Google popup rejects with the same public typed error contract', async () => {
 vi.useFakeTimers()
 vi.spyOn(window, 'open').mockReturnValue({ closed: true, close: vi.fn() } as unknown as Window)
 const promise = client.createAuthService({ ...publicConfig, googleOAuthEnabled: true }).reauthenticateGoogle()
 const rejected = promise.catch(error => error)
 await vi.advanceTimersByTimeAsync(251)
 expect(await rejected).toMatchObject({ code: 'AUTH_FAILED', status: 401 })
})
it('standalone missing-proof recovery and email reauthentication preserve query and hash destinations', async () => {
 vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ user: { email: 'a@example.test' } })).mockResolvedValueOnce(Response.json({ success: true, context: 'a'.repeat(64), retryAfter: 60 })))
 const host = await mount(<client.SetPasswordForm />, 'redirect=%2Fcheckout%3Fitem%3D1%23payment')
 expect(host.querySelector('a')?.getAttribute('href')).toBe('/members/login?redirect=%2Fcheckout%3Fitem%3D1%23payment')
 await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Verify by email')!.click())
 expect(push).toHaveBeenCalledWith(`/members/verify-otp?email=a%40example.test&purpose=reauth&context=${'a'.repeat(64)}&retryAfter=60&redirect=%2Fcheckout%3Fitem%3D1%23payment`)
})
it.each(['tailwind', 'hero-ui'] as const)('exported standalone LoginPage %s advertises enabled signup and respects consumer link overrides', async style => {
 const host = await mount(<client.LoginPage style={style} onPasswordLogin={async () => {}} />, 'redirect=%2Fcheckout%23payment', true)
 expect([...host.querySelectorAll('a')].find(link => link.textContent === 'Sign up')?.getAttribute('href')).toBe('/members/signup?redirect=%2Fcheckout%23payment')
 const overridden = await mount(<client.LoginPage style={style} onPasswordLogin={async () => {}} signupUrl="/join" />, 'redirect=%2Fcheckout%23payment', true)
 expect([...overridden.querySelectorAll('a')].find(link => link.textContent === 'Sign up')?.getAttribute('href')).toBe('/join?redirect=%2Fcheckout%23payment')
})

it('the standalone public configuration preserves explicit Spanish while a sibling remains English', async () => {
 const host = document.createElement('div'); document.body.append(host); const root = createRoot(host); roots.push(root)
 await act(async () => root.render(<><AuthConfigProvider publicConfig={{ ...publicConfig, locale: 'es' }}><section id="es"><client.LoginForm onPasswordLogin={async () => {}} /></section></AuthConfigProvider><AuthConfigProvider publicConfig={{ ...publicConfig, locale: 'en' }}><section id="en"><client.LoginForm onPasswordLogin={async () => {}} /></section></AuthConfigProvider></>))
 expect(host.querySelector('#es')?.textContent).toContain('Continuar')
 expect(host.querySelector('#en')?.textContent).toContain('Continue')
})
import { Input as HeroInput } from '../src/components/ui/hero'
it('only invalid HeroUI labels use the dark high-contrast danger foreground', async () => {
 const host = await mount(<><HeroInput label="Invalid field" value="" error="Try again" /><HeroInput label="Valid field" value="" /></>)
 const labels = host.querySelectorAll<HTMLLabelElement>('label')
 expect(labels[0].style.color).toMatch(/^(#b91c1c|rgb\(185, 28, 28\))$/i)
 expect(labels[1].style.color).toBe('')
 expect(host.querySelector('input[aria-invalid="true"]')?.getAttribute('aria-describedby')).toBeTruthy()
})
it('a rendered standalone email reauthentication returns to the full destination after password completion', async () => {
 const complete = vi.fn(async () => {})
 const config = { ...publicConfig, authBasePath: '/members', otpLogin: true }
 vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ user: { email: 'a@example.test' } })).mockResolvedValueOnce(Response.json({ success: true, context: 'a'.repeat(64), retryAfter: 60 })).mockResolvedValueOnce(Response.json({ success: true, permit: 'limited', expiresAt: Date.now() + 300000 })).mockResolvedValueOnce(Response.json({ success: true })))
 function Journey() {
  const [url, setUrl] = React.useState('/members/set-password?redirect=%2Fcheckout%3Fitem%3D1%23payment')
  const parsed = new URL(url, 'https://app.example')
  return <AuthConfigProvider publicConfig={config}><AuthFlowContext.Provider value={{ push: setUrl, complete, searchParams: parsed.searchParams }}>{parsed.pathname.endsWith('/verify-otp') ? <client.VerifyOtpForm /> : <client.SetPasswordForm />}</AuthFlowContext.Provider></AuthConfigProvider>
 }
 const host = document.createElement('div'); document.body.append(host); const root = createRoot(host); roots.push(root)
 await act(async () => root.render(<Journey />))
 await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Verify by email')!.click())
 const paste = new Event('paste', { bubbles: true, cancelable: true })
 Object.defineProperty(paste, 'clipboardData', { value: { getData: () => '123456' } })
 await act(async () => host.querySelector('input')!.dispatchEvent(paste))
 await act(async () => {
  for (const input of host.querySelectorAll<HTMLInputElement>('input')) {
   Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'the river carries quiet dreams')
   input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }))
  }
 })
 await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
 expect(complete).toHaveBeenCalledWith('/checkout?item=1#payment')
})
it('a popup blocked by the browser throws only a typed unavailable error', async () => {
 vi.spyOn(window, 'open').mockImplementation(() => { throw new Error('private browser details') })
 const failure = await client.createAuthService({ ...publicConfig, googleOAuthEnabled: true }).reauthenticateGoogle().catch(error => error)
 expect(failure).toBeInstanceOf(client.AuthRequestError)
 expect(failure).toMatchObject({ code: 'AUTH_UNAVAILABLE', status: 503 })
 expect(failure.message).not.toContain('private browser')
})
it('a popup close failure remains a typed unavailable result rather than an unhandled event', async () => {
 vi.useFakeTimers()
 vi.spyOn(window, 'open').mockReturnValue({ closed: true, close: () => { throw new Error('private close failure') } } as unknown as Window)
 const result = client.createAuthService({ ...publicConfig, googleOAuthEnabled: true }).reauthenticateGoogle().catch(error => error)
 await vi.advanceTimersByTimeAsync(251)
 expect(await result).toMatchObject({ code: 'AUTH_UNAVAILABLE', status: 503 })
})
it('HeroUI server errors remain announced without blocking valid keyboard retry or weakening required/email constraints', async () => {
 const host = await mount(<><HeroInput label="Password retry" type="password" value="correct existing credential" error="Sign in failed" isRequired /><HeroInput label="Required email" type="email" value="" isRequired /><HeroInput label="Malformed email" type="email" value="not an email" isRequired /></>)
 const inputs = host.querySelectorAll<HTMLInputElement>('input')
 expect(inputs[0].getAttribute('aria-invalid')).toBe('true')
 expect(inputs[0].getAttribute('aria-describedby')).toBeTruthy()
 expect(inputs[0].checkValidity()).toBe(true)
 expect(inputs[1].checkValidity()).toBe(false)
 expect(inputs[2].checkValidity()).toBe(false)
})
import { AuthModal } from '../src/components/AuthModal'
it('native modal cycles Tab at enabled visible edges while preserving normal keys, Escape and trigger restoration', async () => {
 HTMLDialogElement.prototype.showModal = function () { this.open = true }
 HTMLDialogElement.prototype.close = function () { this.open = false }
 const trigger = document.createElement('button'); trigger.textContent = 'Open'; document.body.append(trigger); trigger.focus()
 function Modal() {
  const [open, setOpen] = React.useState(true)
  return open ? <AuthModal style="tailwind" label="Sign in" closeLabel="Close" onClose={() => setOpen(false)}><input aria-label="Email" /><button disabled>Disabled</button><fieldset disabled><button>Disabled fieldset</button></fieldset><button tabIndex={-1}>Not tabbable</button><input type="hidden" /><div hidden><button>Hidden</button></div><div style={{ display: 'none' }}><button>Invisible</button></div><div aria-hidden="true"><button>Inaccessible</button></div><a href="/next">Last</a></AuthModal> : null
 }
 const host = await mount(<Modal />)
 const close = host.querySelector<HTMLButtonElement>('button')!
 const last = host.querySelector<HTMLAnchorElement>('a')!
 last.focus()
 const forward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
 await act(async () => last.dispatchEvent(forward))
 expect(forward.defaultPrevented).toBe(true)
 expect(document.activeElement).toBe(close)
 const reverse = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })
 await act(async () => close.dispatchEvent(reverse))
 expect(reverse.defaultPrevented).toBe(true)
 expect(document.activeElement).toBe(last)
 const chrome = new KeyboardEvent('keydown', { key: 'F6', bubbles: true, cancelable: true })
 last.dispatchEvent(chrome); expect(chrome.defaultPrevented).toBe(false)
 const input = host.querySelector<HTMLInputElement>('input')!
 const middle = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
 input.focus(); input.dispatchEvent(middle); expect(middle.defaultPrevented).toBe(false)
 await act(async () => host.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true })))
 expect(host.querySelector('dialog')).toBeNull()
 expect(document.activeElement).toBe(trigger)
 trigger.remove()
})
import { storePasswordProof } from '../src/auth/application/services/passwordProof'
it('password visibility has a comfortable target and localized keyboard toggle for both fields', async () => {
 storePasswordProof(publicConfig, { purpose: 'recovery', permit: 'limited', expiresAt: Date.now() + 300000 })
 const host = await mount(<client.SetPasswordForm locale="es" />)
 const toggle = host.querySelector<HTMLButtonElement>('button[aria-label="Mostrar contraseña"]')!
 expect(toggle).toBeTruthy()
 expect(parseFloat(window.getComputedStyle(toggle).width)).toBeGreaterThanOrEqual(40)
 expect(parseFloat(window.getComputedStyle(toggle).height)).toBeGreaterThanOrEqual(40)
 expect(host.querySelectorAll('input[type="password"]')).toHaveLength(2)
 toggle.focus()
 await act(async () => toggle.click())
 expect(document.activeElement).toBe(toggle)
 expect(toggle.getAttribute('aria-label')).toBe('Ocultar contraseña')
 expect(host.querySelectorAll('input[type="text"]')).toHaveLength(2)
})

import { Button as HeroButton } from '../src/components/ui/hero'
it.each([['es', 'Cargando'], ['en', 'Loading']] as const)('Hero pending announcements remain localized and self-contained after navigation (%s)', async (locale, loading) => {
 const host = document.createElement('div'); document.body.append(host); const root = createRoot(host); roots.push(root)
 const press = vi.fn()
 const render = async (pending: boolean, completed = false) => { await act(async () => root.render(<AuthConfigProvider publicConfig={{ ...publicConfig, locale }}>{completed ? <h1>OTP</h1> : <HeroButton type="submit" isLoading={pending} onPress={press}>Continue</HeroButton>}</AuthConfigProvider>)) }
 await render(false)
 await act(async () => host.querySelector('button')!.focus())
 await render(true)
 const status = host.querySelector('[role="status"]')
 const pendingText = status?.textContent
 const disabled = host.querySelector('button')?.disabled
 await act(async () => host.querySelector('button')!.click())
 expect(press).not.toHaveBeenCalled()
 await render(false)
 const completedText = host.querySelector('[aria-live="polite"]')?.textContent
 await render(false, true)
 for (const announcement of document.querySelectorAll('[role="img"][aria-labelledby]')) {
  for (const id of announcement.getAttribute('aria-labelledby')!.split(/\s+/)) expect(document.getElementById(id)).not.toBeNull()
 }
 expect(pendingText).toBe(loading)
 expect(disabled).toBe(true)
 expect(completedText).toBe('')
 expect(host.textContent).toBe('OTP')
})
