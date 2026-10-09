'use client'

import { useAuthPresentation } from '../contexts/AuthAppearanceContext'

/** Shared markup uses adapter-specific colors; layout/behavior remain identical. */
export function useAuthThemeClasses() {
  const { style } = useAuthPresentation()
  return style === 'hero-ui'
    ? {
        foreground: 'text-foreground',
        muted: 'text-muted',
        subtle: 'text-muted',
        secondaryForeground: 'text-foreground',
        noticeIcon: 'text-accent',
        hoverForeground: 'hover:text-foreground',
        border: 'border-border',
        error: 'bg-danger-soft text-danger-soft-foreground border-danger',
        notice: 'bg-accent-soft border-accent',
        noticeText: 'text-accent-soft-foreground',
        strengthActive: 'bg-accent',
        strengthInactive: 'bg-default',
      }
    : {
        foreground: 'text-gray-900',
        muted: 'text-gray-600',
        subtle: 'text-gray-500',
        secondaryForeground: 'text-gray-700',
        noticeIcon: 'text-blue-500',
        hoverForeground: 'hover:text-gray-900',
        border: 'border-gray-300',
        error: 'bg-red-50 text-red-700 border-red-200',
        notice: 'bg-blue-50 border-blue-200',
        noticeText: 'text-blue-700',
        strengthActive: 'bg-[#D5E855]',
        strengthInactive: 'bg-gray-200',
      }
}
