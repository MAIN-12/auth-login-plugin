'use client'

import React, { useEffect, useRef } from 'react'
import styles from './AuthPageTexture.module.css'

export type AuthTexture = 'none' | 'spotlight-dots' | 'spotlight-grid'

/** Decorative adapter: pointer updates never enter React state or auth logic. */
export function AuthPageTexture({ texture }: { texture: Exclude<AuthTexture, 'none'> }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const overlay = ref.current!
    const layout = overlay.parentElement!
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const pointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    let frame = 0
    let active = false
    let x = 0, y = 0, targetX = 0, targetY = 0, lastTime = 0
    const stop = () => {
      active = false
      cancelAnimationFrame(frame)
      frame = 0
      lastTime = 0
      overlay.style.setProperty('--auth-texture-active', '0')
    }
    const paint = (time: number) => {
      const amount = 1 - Math.exp(-Math.min(time - (lastTime || time - 16), 64) / 75)
      lastTime = time
      x += (targetX - x) * amount
      y += (targetY - y) * amount
      overlay.style.setProperty('--auth-texture-x', `${x}px`)
      overlay.style.setProperty('--auth-texture-y', `${y}px`)
      if (Math.abs(targetX - x) + Math.abs(targetY - y) > 0.2) {
        frame = requestAnimationFrame(paint)
      } else {
        frame = 0
        lastTime = 0
      }
    }
    const move = (event: PointerEvent) => {
      if (motion.matches || !pointer.matches || event.pointerType === 'touch') return
      const bounds = layout.getBoundingClientRect()
      targetX = event.clientX - bounds.left
      targetY = event.clientY - bounds.top
      if (!active) {
        x = targetX
        y = targetY
        active = true
        overlay.style.setProperty('--auth-texture-active', '1')
      }
      if (!frame) frame = requestAnimationFrame(paint)
    }
    const visibility = () => { if (document.hidden) stop() }
    layout.addEventListener('pointermove', move, { passive: true })
    layout.addEventListener('pointerleave', stop)
    window.addEventListener('blur', stop)
    window.addEventListener('scroll', stop, { passive: true })
    motion.addEventListener('change', stop)
    pointer.addEventListener('change', stop)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      stop()
      layout.removeEventListener('pointermove', move)
      layout.removeEventListener('pointerleave', stop)
      window.removeEventListener('blur', stop)
      window.removeEventListener('scroll', stop)
      motion.removeEventListener('change', stop)
      pointer.removeEventListener('change', stop)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [])

  return <div ref={ref} aria-hidden="true" data-auth-texture={texture} className={`${styles.texture} ${texture === 'spotlight-grid' ? styles.grid : styles.dots}`}>
    <div className={styles.base} />
    <div className={styles.spotlight} />
  </div>
}
