// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthLayout } from '../src/components/AuthLayout'

let root: Root
let host: HTMLDivElement
let frames: Map<number, FrameRequestCallback>
let nextFrame: number
let motion: MediaQueryList
let fine: MediaQueryList
function query(matches: boolean): MediaQueryList {
  return Object.assign(new EventTarget(), {
    matches,
    media: '',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }) as unknown as MediaQueryList
}
async function render(texture?: 'none' | 'spotlight-dots' | 'spotlight-grid') {
  await act(async () =>
    root.render(
      <AuthLayout backgroundClass="bg-black" texture={texture}>
        <button>Login</button>
      </AuthLayout>,
    ),
  )
}
function move(pointerType = 'mouse') {
  host
    .querySelector('main')!
    .dispatchEvent(
      new PointerEvent('pointermove', { clientX: 140, clientY: 220, pointerType, bubbles: true }),
    )
}
function tick(time = 16) {
  const pending = [...frames.values()]
  frames.clear()
  pending.forEach((callback) => callback(time))
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  frames = new Map()
  nextFrame = 0
  motion = query(false)
  fine = query(true)
  vi.stubGlobal(
    'matchMedia',
    vi.fn((value: string) => (value.includes('reduced-motion') ? motion : fine)),
  )
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback)
      return nextFrame
    }),
  )
  vi.stubGlobal(
    'cancelAnimationFrame',
    vi.fn((id: number) => frames.delete(id)),
  )
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
})

describe('optional page textures', () => {
  it('does not install the effect when omitted or disabled', async () => {
    await render()
    expect(host.querySelector('[data-auth-texture]')).toBeNull()
    await render('none')
    expect(window.matchMedia).not.toHaveBeenCalled()
  })
  it.each(['spotlight-dots', 'spotlight-grid'] as const)(
    '%s preserves the background and content and tracks layout-relative coordinates',
    async (texture) => {
      await render(texture)
      const main = host.querySelector('main')!
      vi.spyOn(main, 'getBoundingClientRect').mockReturnValue({ left: 40, top: 20 } as DOMRect)
      const overlay = host.querySelector<HTMLElement>('[data-auth-texture]')!
      expect(main.classList.contains('bg-black')).toBe(true)
      expect(overlay.getAttribute('aria-hidden')).toBe('true')
      expect(host.querySelector('button')!.closest('[aria-hidden]')).toBeNull()
      move()
      move()
      expect(frames.size).toBe(1)
      tick()
      expect(overlay.style.getPropertyValue('--auth-texture-x')).toBe('100px')
      expect(overlay.style.getPropertyValue('--auth-texture-y')).toBe('200px')
      expect(frames.size).toBe(0)
      main.dispatchEvent(new PointerEvent('pointerleave'))
      expect(overlay.style.getPropertyValue('--auth-texture-active')).toBe('0')
    },
  )
  it.each(['reduced motion', 'coarse pointer', 'touch event'])(
    'keeps the texture static for %s',
    async (kind) => {
      if (kind === 'reduced motion') Object.assign(motion, { matches: true })
      if (kind === 'coarse pointer') Object.assign(fine, { matches: false })
      await render('spotlight-dots')
      move(kind === 'touch event' ? 'touch' : 'mouse')
      expect(frames.size).toBe(0)
      expect(host.querySelector('[data-auth-texture]')).toBeTruthy()
    },
  )
  it('cancels frames on preference changes and removes listeners when disabled', async () => {
    await render('spotlight-grid')
    move()
    expect(frames.size).toBe(1)
    Object.assign(motion, { matches: true })
    motion.dispatchEvent(new Event('change'))
    expect(frames.size).toBe(0)
    Object.assign(motion, { matches: false })
    move()
    expect(frames.size).toBe(1)
    await render('none')
    expect(frames.size).toBe(0)
    move()
    expect(frames.size).toBe(0)
  })
})
