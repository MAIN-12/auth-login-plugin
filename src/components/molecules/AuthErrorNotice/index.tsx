'use client'

import React from 'react'
import { useAuthThemeClasses } from '../../../theme'

export function AuthErrorNotice({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  const theme = useAuthThemeClasses()
  return (
    <div
      role="alert"
      className={`${theme.error} border rounded-lg p-3 text-sm ${className}`.trim()}
    >
      {children}
    </div>
  )
}
