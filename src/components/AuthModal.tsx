'use client'

import React, { lazy, Suspense, useEffect, useRef } from 'react'
import type { AuthStyle } from '../auth/contracts/publicConfig'

const HeroAuthModal = lazy(() => import('./AuthModalHero'))

export interface AuthModalProps {
  children: React.ReactNode
  onClose: () => void
  label: string
  closeLabel: string
}

function NativeAuthModal({ children, onClose, label, closeLabel }: AuthModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    const previousFocus = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = overflow
      previousFocus?.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const dialog = event.currentTarget
        const controls = Array.from(
          dialog.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex]'),
        )
          .filter((element) => {
            if (
              element.tabIndex < 0 ||
              element.matches(':disabled,input[type="hidden"]') ||
              element.closest('fieldset[disabled]')
            )
              return false
            for (
              let ancestor: HTMLElement | null = element;
              ancestor && ancestor !== dialog;
              ancestor = ancestor.parentElement
            ) {
              if (
                ancestor.hidden ||
                ancestor.hasAttribute('inert') ||
                ancestor.getAttribute('aria-hidden') === 'true'
              )
                return false
              const style = window.getComputedStyle(ancestor)
              if (
                style.display === 'none' ||
                style.visibility === 'hidden' ||
                style.visibility === 'collapse'
              )
                return false
            }
            return true
          })
          .sort(
            (left, right) =>
              (left.tabIndex > 0 ? left.tabIndex : Infinity) -
              (right.tabIndex > 0 ? right.tabIndex : Infinity),
          )
        const first = controls[0]
        const last = controls.at(-1)
        if (!first || !last) {
          event.preventDefault()
          dialog.focus()
          return
        }
        const active = document.activeElement
        if (event.shiftKey && (active === first || active === dialog)) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && (active === last || active === dialog)) {
          event.preventDefault()
          first.focus()
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className="m-auto w-[calc(100%_-_2rem)] max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl border-0 bg-white p-0 text-gray-900 shadow-2xl backdrop:bg-black/50"
    >
      <div className="relative p-2">
        <button
          type="button"
          aria-label={closeLabel}
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full p-2 focus-visible:outline-2"
        >
          ✕
        </button>
        {children}
      </div>
    </dialog>
  )
}

export function AuthModal({ style, ...props }: AuthModalProps & { style: AuthStyle }) {
  return style === 'hero-ui' ? (
    <Suspense fallback={null}>
      <HeroAuthModal {...props} />
    </Suspense>
  ) : (
    <NativeAuthModal {...props} />
  )
}
