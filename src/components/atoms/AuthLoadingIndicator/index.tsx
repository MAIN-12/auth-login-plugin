'use client'

import React from 'react'
import { useAuthTranslations } from '../../../contexts/AuthAppearanceContext'

/** Dependency-free so the fallback never waits on the UI library it replaces. */
export function AuthLoadingIndicator() {
  const label = useAuthTranslations().common.loading
  return (
    <div role="status" aria-label={label} className="flex items-center justify-center p-8">
      <svg
        aria-hidden="true"
        width="28"
        height="28"
        viewBox="0 0 24 24"
        className="animate-spin motion-reduce:animate-none"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          opacity="0.2"
        />
        <path
          d="M12 3a9 9 0 0 1 9 9"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}
