// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthPresentationContext } from '../src/contexts/AuthAppearanceContext'
import { AuthConfigProvider } from '../src/authentication/interface/react/providers/AuthConfigProvider/index'
import { publicConfig } from './auth-test-config'
import { resolveAuthConfig } from '../src/configuration/plugin/config'
import { AuthCard } from '../src/components/organisms/AuthCard'
import { AuthCardShell } from '../src/components/organisms/AuthCard/AuthCardShell'
import AuthModalHero from '../src/components/organisms/AuthModal/AuthModalHero'
import { Button } from '../src/components/atoms/Button/Hero'
import { FormField as Input } from '../src/components/molecules/FormField/Hero'
import { OtpInput } from '../src/components/molecules/OtpInput'
import { useAuthThemeClasses } from '../src/theme'

let host: HTMLDivElement
let root: Root
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div')
  host.dataset.theme = 'dark'
  host.style.setProperty('--accent', 'rgb(120, 30, 180)')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})
async function render(children: React.ReactNode, style: 'hero-ui' | 'tailwind' = 'hero-ui') {
  await import('../src/components/atoms/Button/Hero')
  await import('../src/components/atoms/Input/Hero')
  await import('../src/components/atoms/Card/Hero')
  await import('../src/components/atoms/CardHeader/Hero')
  await import('../src/components/atoms/CardContent/Hero')
  await import('../src/components/atoms/CardFooter/Hero')
  await import('../src/components/atoms/CardTitle/Hero')
  await import('../src/components/atoms/CardDescription/Hero')
  await import('../src/components/atoms/Divider/Hero')
  await import('../src/components/atoms/Spinner/Hero')
  await act(async () =>
    root.render(
      <AuthPresentationContext.Provider value={{ style, poweredBy: { enabled: false } }}>
        {children}
      </AuthPresentationContext.Provider>,
    ),
  )
}
function PaletteProbe() {
  const theme = useAuthThemeClasses()
  return <output data-palette>{JSON.stringify(theme)}</output>
}

describe('host HeroUI theme inheritance', () => {
  it('does not override primary button colors or invalid label tokens', async () => {
    await render(
      <>
        <Button>Continue</Button>
        <Input id="theme-email" label="Email" value="bad" error="Invalid" />
      </>,
    )
    expect(host.querySelector('button')?.getAttribute('style')).toBeNull()
    expect(host.querySelector('label')?.getAttribute('style')).toBeNull()
    const input = host.querySelector('input')!
    expect(input.getAttribute('style')).toBeNull()
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.className).not.toMatch(/(?:border|ring|text)-red-/)
    const error = host.querySelector('[data-slot="field-error"]')!
    expect(error).not.toBeNull()
    expect(error.textContent).toBe('Invalid')
    expect(error.className).not.toContain('text-red-')
    expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(error.id)
    expect(host.querySelector('[data-invalid="true"]')).not.toBeNull()
  })

  it('keeps card markup and headings in the host dark/custom theme', async () => {
    await render(
      <AuthCardShell title="Welcome" subtitle="Sign in">
        <Button>Continue</Button>
      </AuthCardShell>,
    )
    expect(host.querySelector('[data-theme="light"], .light')).toBeNull()
    expect(host.querySelector('h1')?.classList.contains('text-foreground')).toBe(true)
    expect(host.querySelector('p')?.classList.contains('text-muted')).toBe(true)
    expect(host.querySelector('[style*="color-scheme"]')).toBeNull()
  })

  it('keeps modal portals under the scoped application theme, not document.body', async () => {
    await render(
      <AuthModalHero label="Sign in" closeLabel="Close" onClose={() => {}}>
        <Button>Continue</Button>
      </AuthModalHero>,
    )
    const dialog = document.querySelector('[role="dialog"]')!
    expect(dialog).not.toBeNull()
    expect(host.contains(dialog)).toBe(true)
    expect(dialog.closest('[data-theme]')).toBe(host)
    expect(dialog.classList.contains('bg-white')).toBe(false)
    expect(dialog.style.background).toBe('transparent')
    expect(dialog.style.colorScheme).toBe('')
    expect(host.querySelector('[data-theme="light"], .light')).toBeNull()
  })

  it('uses native theme OTP slots without overriding danger colors or numeric input', async () => {
    const values: string[] = []
    await render(
      <OtpInput value="" error="Invalid" onValueChange={(value) => values.push(value)} />,
    )
    await vi.waitFor(async () => {
      await act(async () => {})
      expect(host.querySelector('[data-slot="input-otp-slot"]')).not.toBeNull()
    })
    const input = host.querySelector('input')!
    expect(host.querySelectorAll('input')).toHaveLength(1)
    const slots = host.querySelectorAll('[data-slot="input-otp-slot"]')
    expect(slots).toHaveLength(6)
    for (const slot of slots) {
      expect(slot.getAttribute('data-invalid')).toBe('true')
      expect(slot.getAttribute('style')).toBeNull()
      expect(slot.className).not.toMatch(/(?:border|ring|text)-red-/)
    }
    expect(input.getAttribute('style')).not.toContain('#ef4444')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(host.querySelector('[data-slot="field-error"]')?.textContent).toBe('Invalid')
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
        input,
        '123456',
      )
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(values).toEqual(['123456'])
  })

  it('retains standalone Tailwind OTP invalid colors outside the HeroUI theme', async () => {
    await render(<OtpInput value="" error="Invalid" />, 'tailwind')
    for (const digit of host.querySelectorAll('input')) {
      expect(digit.getAttribute('aria-invalid')).toBe('true')
      expect(digit.style.borderColor).toBe('#ef4444')
      expect(digit.classList.contains('aria-[invalid=true]:border-danger')).toBe(false)
    }
  })

  it('uses semantic colors for shared text/status/strength, retaining the Tailwind palette', async () => {
    await render(<PaletteProbe />)
    const hero = JSON.parse(host.querySelector('output')!.textContent!)
    expect(hero.foreground).toBe('text-foreground')
    expect(hero.error).toBe('bg-danger-soft text-danger-soft-foreground border-danger')
    expect(hero.strengthActive).toBe('bg-accent')
    await render(<PaletteProbe />, 'tailwind')
    const tailwind = JSON.parse(host.querySelector('output')!.textContent!)
    expect(tailwind.foreground).toBe('text-gray-900')
    expect(tailwind.error).toBe('bg-red-50 text-red-700 border-red-200')
    expect(tailwind.strengthActive).toBe('bg-[#D5E855]')
  })
})

describe('explicit HeroUI card appearance', () => {
  it('inherits by default and changes only its own theme without replacing the form', async () => {
    const card = (theme?: 'inherit' | 'light' | 'dark') => (
      <AuthCard theme={theme} mobileVariant="card">
        <input aria-label="Draft email" />
      </AuthCard>
    )
    await render(card())
    const scope = host.querySelector('[data-auth-theme]') as HTMLElement
    const input = host.querySelector('input')!
    input.value = 'draft@example.com'
    expect(scope.hasAttribute('data-theme')).toBe(false)
    for (const theme of ['light', 'dark', 'inherit'] as const) {
      await render(card(theme))
      expect(host.querySelector('input')).toBe(input)
      expect(input.value).toBe('draft@example.com')
      expect(host.dataset.theme).toBe('dark')
      expect(scope.getAttribute('data-theme')).toBe(theme === 'inherit' ? null : theme)
      expect(scope.style.colorScheme).toBe(theme === 'inherit' ? '' : theme)
    }
  })

  it('does not advertise dark mode for the standalone Tailwind palette', async () => {
    await render(
      <AuthCard theme="dark">
        <input aria-label="Email" />
      </AuthCard>,
      'tailwind',
    )
    expect(host.querySelector('[data-auth-theme]')?.hasAttribute('data-theme')).toBe(false)
  })
})

describe('plugin theme defaults', () => {
  it('validates and defaults the public plugin setting', () => {
    const options = {
      passwordLogin: true,
      otpLogin: false,
      providers: { google: false as const },
      allowSignup: false,
      recovery: false,
    }
    expect(resolveAuthConfig(options).theme).toBe('inherit')
    expect(resolveAuthConfig({ ...options, theme: 'dark' }).theme).toBe('dark')
    expect(() => resolveAuthConfig({ ...options, theme: 'invalid' as 'dark' })).toThrow(
      'invalid theme',
    )
  })

  it('uses the plugin theme, allows explicit overrides, and preserves the form', async () => {
    const card = (theme?: 'inherit' | 'light' | 'dark') => (
      <AuthConfigProvider publicConfig={{ ...publicConfig, style: 'hero-ui', theme: 'dark' }}>
        <AuthCard theme={theme}>
          <input aria-label="Draft" />
        </AuthCard>
      </AuthConfigProvider>
    )
    await render(card())
    const input = host.querySelector('input')!
    input.value = 'draft@example.com'
    expect(host.querySelector('[data-auth-theme]')?.getAttribute('data-theme')).toBe('dark')
    for (const theme of ['light', 'inherit', undefined] as const) {
      await render(card(theme))
      expect(host.querySelector('[data-auth-theme]')?.getAttribute('data-theme')).toBe(
        theme === 'inherit' ? null : (theme ?? 'dark'),
      )
      expect(host.querySelector('input')).toBe(input)
      expect(input.value).toBe('draft@example.com')
    }
  })
})
