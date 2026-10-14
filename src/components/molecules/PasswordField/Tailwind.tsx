'use client'

import React from 'react'
import { FormField } from '../FormField/Tailwind'
import type { ResolvedPasswordFieldProps } from './types'
import { VisibilityIcon } from './VisibilityIcon'
import { useAuthThemeClasses } from '../../../theme'

/** Masked by default; optional controlled visibility preserves password establishment. */
export function PasswordField({
  visible = false,
  onToggleVisibility,
  visibilityLabel,
  ...props
}: ResolvedPasswordFieldProps) {
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
        <VisibilityIcon visible={visible} />
      </button>
    </div>
  )
}
