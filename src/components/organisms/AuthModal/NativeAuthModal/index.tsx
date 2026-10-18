'use client'

import React, { useEffect, useRef } from 'react'
import type { AuthModalProps } from '../types'

export function NativeAuthModal({
  children,
  onClose,
  label,
  closeLabel,
  hideCloseButton = false,
}: AuthModalProps) {
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
      className="m-auto w-[calc(100%_-_2rem)] max-w-[400px] max-h-[90dvh] overflow-y-auto border-0 bg-transparent p-0 backdrop:bg-black/50"
    >
      <div className={hideCloseButton ? 'relative' : 'relative pt-12'}>
        {!hideCloseButton && (
          <button
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            className="absolute right-0 top-0 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            ✕
          </button>
        )}
        {children}
      </div>
    </dialog>
  )
}
