'use client'

import React from 'react'
import { FormField, type FormFieldProps } from '../FormField'
import { useAuthThemeClasses } from '../../../theme'

/*
 * Eye and EyeOff SVGs from https://github.com/lucide-icons/lucide (ISC License).
 * Copyright (c) 2026 Lucide Icons and Contributors
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

/** Masked by default; optional controlled visibility preserves password establishment. */
export function PasswordField({
  visible = false,
  onToggleVisibility,
  visibilityLabel,
  ...props
}: Omit<FormFieldProps, 'type'> & {
  visible?: boolean
  onToggleVisibility?: () => void
  visibilityLabel?: string
}) {
  const theme = useAuthThemeClasses()
  const field = <FormField {...props} type={visible ? 'text' : 'password'} />
  if (!onToggleVisibility) return field
  return (
    <div className="relative">
      {field}
      <button
        type="button"
        aria-label={visibilityLabel}
        onClick={onToggleVisibility}
        style={{ width: 40, height: 40 }}
        className={`absolute right-2 top-7 flex items-center justify-center rounded-md ${theme.muted} ${theme.hoverForeground} focus-visible:outline-2`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          {visible ? (
            <>
              <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
              <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
              <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
              <path d="m2 2 20 20" />
            </>
          ) : (
            <>
              <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
              <circle cx="12" cy="12" r="3" />
            </>
          )}
        </svg>
      </button>
    </div>
  )
}
