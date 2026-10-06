// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { publicConfig } from './auth-test-config'
import { AuthConfigProvider } from '../src/components/AuthConfigContext'
import { AuthCard } from '../src/components/AuthCard'

const loading = vi.hoisted(() => {
  let release!: () => void
  const promise = new Promise<void>(resolve => { release = resolve })
  return { promise, release }
})
vi.mock('../src/components/ui/hero', async importOriginal => {
  await loading.promise
  return importOriginal()
})
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
let root: Root | undefined
let host: HTMLDivElement | undefined
afterEach(async () => {
  if (root) await act(async () => root!.unmount())
  host?.remove()
})

it('shows one loader until the complete HeroUI login card is ready', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root!.render(<AuthConfigProvider publicConfig={publicConfig}><AuthCard slug="login" style="hero-ui" locale="en" mobileVariant="modal" showGoogleOAuth /></AuthConfigProvider>))
  expect(host.querySelectorAll('[role="status"]')).toHaveLength(1)
  expect(host.querySelector('h1')).toBeNull()
  expect(host.querySelector('form')).toBeNull()
  expect(host.querySelector('[data-auth-card-ready]')).toBeNull()

  await act(async () => { loading.release(); await import('../src/components/ui/hero') })
  expect(host.querySelector('[role="status"]')).toBeNull()
  expect(host.querySelector('[data-auth-card-ready]')).toBeTruthy()
  expect(host.querySelector('h1')).toBeTruthy()
  expect(host.querySelector('input[type="email"]')).toBeTruthy()
  expect(host.querySelector('button[type="submit"]')).toBeTruthy()
  expect(host.textContent).not.toContain('Continue with Google')
})
