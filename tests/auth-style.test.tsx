// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { withAuthStyle } from '../src/hoc/withAuthStyle'
import { AuthPresentationContext } from '../src/contexts/AuthAppearanceContext'
import { AuthConfigContext } from '../src/contexts/AuthConfigContext'
import { AuthCardLoadingContext } from '../src/contexts/AuthCardLoadingContext'
import { getUiTranslations } from '../src/i18n/ui'
import { publicConfig } from './auth-test-config'

let host: HTMLDivElement
let root: Root
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})
function Tailwind({ label }: { label: string }) {
  return <output data-style="tailwind">{label}</output>
}
function Hero({ label }: { label: string }) {
  return <output data-style="hero-ui">{label}</output>
}
it('selects config defaults without loading HeroUI for Tailwind', async () => {
  const loader = vi.fn(async () => ({ default: Hero }))
  const Styled = withAuthStyle(Tailwind, loader)
  await act(async () =>
    root.render(
      <AuthConfigContext.Provider value={{ ...publicConfig, style: 'tailwind' }}>
        <Styled label="configured" />
      </AuthConfigContext.Provider>,
    ),
  )
  expect(host.querySelector('output')?.dataset.style).toBe('tailwind')
  expect(loader).not.toHaveBeenCalled()
  await act(async () =>
    root.render(
      <AuthConfigContext.Provider value={{ ...publicConfig, style: 'hero-ui' }}>
        <Styled label="configured" />
      </AuthConfigContext.Provider>,
    ),
  )
  expect(host.querySelector('output')?.dataset.style).toBe('hero-ui')
  expect(loader).toHaveBeenCalledTimes(1)
})
it('keeps adjacent scopes independent and lets explicit style override context', async () => {
  const Styled = withAuthStyle(Tailwind, async () => ({ default: Hero }))
  await act(async () =>
    root.render(
      <>
        <AuthPresentationContext.Provider value={{ style: 'hero-ui' }}>
          <Styled label="hero" />
          <Styled label="override" style="tailwind" />
        </AuthPresentationContext.Provider>
        <AuthPresentationContext.Provider value={{ style: 'tailwind' }}>
          <Styled label="tailwind" />
          <Styled label="override-hero" style="hero-ui" />
        </AuthPresentationContext.Provider>
      </>,
    ),
  )
  expect([...host.querySelectorAll('output')].map((element) => element.dataset.style)).toEqual([
    'hero-ui',
    'tailwind',
    'tailwind',
    'hero-ui',
  ])
})
it('uses a localized pending fallback without affecting a neighboring Tailwind instance', async () => {
  let release!: () => void
  const promise = new Promise<{ default: typeof Hero }>((resolve) => {
    release = () => resolve({ default: Hero })
  })
  const Styled = withAuthStyle(Tailwind, () => promise)
  await act(async () =>
    root.render(
      <>
        <AuthPresentationContext.Provider value={{ style: 'hero-ui', locale: 'es' }}>
          <Styled label="pending" />
        </AuthPresentationContext.Provider>
        <Styled label="ready" />
      </>,
    ),
  )
  expect(host.querySelector('[role="status"]')?.getAttribute('aria-label')).toBe('Cargando')
  expect(host.querySelector('output')?.textContent).toBe('ready')
  await act(async () => release())
  expect(host.querySelector('[role="status"]')).toBeNull()
  expect(host.querySelectorAll('output')).toHaveLength(2)
})
it('defers card suspense to its enclosing boundary and keeps modal fallback empty', async () => {
  const load = () => new Promise<{ default: typeof Hero }>(() => {})
  const Styled = withAuthStyle(Tailwind, load)
  const Modal = withAuthStyle(Tailwind, load, { fallback: 'none' })
  await act(async () =>
    root.render(
      <AuthPresentationContext.Provider value={{ style: 'hero-ui' }}>
        <React.Suspense fallback={<span data-card-loading />}>
          <AuthCardLoadingContext.Provider value>
            <Styled label="card" />
          </AuthCardLoadingContext.Provider>
        </React.Suspense>
        <Modal label="modal" />
      </AuthPresentationContext.Provider>,
    ),
  )
  expect(host.querySelector('[data-card-loading]')).toBeTruthy()
  expect(host.querySelector('[role="status"]')).toBeNull()
  expect(host.querySelector('output')).toBeNull()
})
it('centralizes close labels with locale fallback and partial message overrides', () => {
  expect(getUiTranslations('es-CO').common.close).toBe('Cerrar')
  expect(getUiTranslations('en').common.close).toBe('Close')
  expect(getUiTranslations('fr').common.close).toBe('Close')
  expect(getUiTranslations('es-CO', { 'es-CO': { common: { close: 'Salir' } } }).common.close).toBe(
    'Salir',
  )
  expect(getUiTranslations('es', { es: { common: { close: 'Salir' } } }).common.close).toBe('Salir')
})
