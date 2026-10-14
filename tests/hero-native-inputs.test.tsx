// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AuthPresentationContext } from '../src/contexts/AuthAppearanceContext'
import { OtpInput } from '../src/components/molecules/OtpInput'
import { PasswordField } from '../src/components/molecules/PasswordField'

let host: HTMLDivElement
let root: Root
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div')
  host.dataset.theme = 'dark'
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})
async function render(children: React.ReactNode) {
  await act(async () =>
    root.render(
      <AuthPresentationContext.Provider value={{ style: 'hero-ui', poweredBy: { enabled: false } }}>
        {children}
      </AuthPresentationContext.Provider>,
    ),
  )
  await vi.waitFor(
    async () => {
      await act(async () => {})
      expect(host.querySelector('input')).not.toBeNull()
    },
    { timeout: 5000 },
  )
}
async function enter(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

it('renders native HeroUI OTP slots around one numeric controlled input', async () => {
  function Entry() {
    const [value, setValue] = React.useState('12    ')
    return (
      <OtpInput
        value={value}
        onValueChange={setValue}
        locale="es"
        autoFocus
        error="Código inválido"
      />
    )
  }
  await render(<Entry />)
  expect(host.querySelectorAll('input')).toHaveLength(1)
  expect(host.querySelectorAll('[data-slot="input-otp-group"]')).toHaveLength(1)
  expect(host.querySelectorAll('[data-slot="input-otp-slot"]')).toHaveLength(6)
  const input = host.querySelector('input')!
  expect(input.value).toBe('12')
  expect(input.inputMode).toBe('numeric')
  expect(input.autocomplete).toBe('one-time-code')
  expect(input.getAttribute('aria-invalid')).toBe('true')
  expect(document.activeElement).toBe(input)
  expect(input.getAttribute('style')).not.toContain('#ef4444')
  expect(host.querySelector('[data-slot="field-error"]')?.textContent).toBe('Código inválido')
  await enter(input, '123a')
  expect(input.value).toBe('12')
  await enter(input, '1234567')
  expect(input.value).toBe('123456')
  expect(host.querySelectorAll('[data-slot="input-otp-slot-value"]')).toHaveLength(6)
})

it('uses native password group and suffix button with controlled visibility and error associations', async () => {
  function Entry() {
    const [visible, setVisible] = React.useState(false)
    return (
      <PasswordField
        id="native-password"
        value="draft"
        label="Password"
        help="Hint"
        error="Invalid"
        visible={visible}
        onToggleVisibility={() => setVisible(!visible)}
        visibilityLabel={visible ? 'Hide password' : 'Show password'}
        isRequired
        variant="secondary"
      />
    )
  }
  await render(<Entry />)
  const group = host.querySelector('[data-slot="input-group"]')!
  expect(group).not.toBeNull()
  expect(host.querySelector('[data-slot="input-group-suffix"]')).not.toBeNull()
  const input = host.querySelector('input')!
  expect(input.type).toBe('password')
  expect(input.value).toBe('draft')
  expect(input.required).toBe(true)
  expect(input.getAttribute('aria-invalid')).toBe('true')
  expect(input.getAttribute('aria-describedby')?.split(' ')).toEqual(
    expect.arrayContaining(['native-password-help', 'native-password-error']),
  )
  const toggle = host.querySelector<HTMLButtonElement>('button')!
  expect(toggle.classList.contains('button')).toBe(true)
  expect(toggle.className).not.toContain('absolute')
  expect(toggle.getAttribute('style')).toBeNull()
  expect(toggle.type).toBe('button')
  await act(async () => toggle.click())
  expect(input.type).toBe('text')
  expect(input.value).toBe('draft')
  expect(toggle.getAttribute('aria-label')).toBe('Hide password')
})
