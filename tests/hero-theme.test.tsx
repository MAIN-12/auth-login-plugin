// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AuthPresentationContext } from '../src/components/auth-presentation/AuthPresentationContext'
import { AuthCardShell } from '../src/components/organisms/AuthCard/AuthCardShell'
import AuthModalHero from '../src/components/organisms/AuthModal/AuthModalHero'
import { Button } from '../src/components/atoms/adapters/hero'
import { FormField as Input } from '../src/components/molecules/adapters/hero'
import { OtpInput } from '../src/components/molecules/OtpInput'
import { useAuthThemeClasses } from '../src/components/ui/theme'

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
    expect(dialog.getAttribute('style')).toBeNull()
    expect(host.querySelector('[data-theme="light"], .light')).toBeNull()
  })

  it('uses theme field/focus/danger tokens for positional OTP without changing digit behavior', async () => {
    const values: string[] = []
    await render(
      <OtpInput value="" error="Invalid" onValueChange={(value) => values.push(value)} />,
    )
    const digits = host.querySelectorAll('input')
    expect(digits).toHaveLength(6)
    expect(digits[0].classList.contains('input')).toBe(true)
    expect(digits[0].classList.contains('bg-white')).toBe(false)
    expect(digits[0].classList.contains('focus:ring-focus')).toBe(true)
    expect(digits[0].classList.contains('aria-[invalid=true]:border-danger')).toBe(true)
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
        digits[0],
        '123456',
      )
      digits[0].dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(values).toEqual(['123456'])
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
