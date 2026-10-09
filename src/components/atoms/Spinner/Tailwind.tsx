'use client'
import React from 'react'
import type { SpinnerProps } from './types'
import { useAuthTranslations } from '../../../contexts/AuthAppearanceContext'
export const Spinner: React.FC<SpinnerProps> = ({ size = 'lg', className = '' }) => (
  <div
    className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${size === 'lg' ? 'w-6 h-6' : 'w-4 h-4'} ${className}`}
    role="status"
  >
    <span className="sr-only">{useAuthTranslations().common.loading}</span>
  </div>
)
