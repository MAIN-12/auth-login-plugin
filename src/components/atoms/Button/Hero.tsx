'use client'
import React from 'react'
import type { ButtonProps } from './types'
import { Button as HeroButton, Spinner as HeroSpinner } from '@heroui/react'
import { useAuthTranslations } from '../../../contexts/AuthAppearanceContext'
export function Button({
  children,
  type = 'button',
  fullWidth = true,
  size = 'lg',
  isLoading,
  isDisabled,
  onPress,
  onClick,
  variant = 'primary',
  className,
}: ButtonProps) {
  const t = useAuthTranslations()
  // Vendor pending announcements retain button IDs after navigation unmounts them.
  // A scoped text live region has no external label references to orphan.
  return (
    <>
      <HeroButton
        type={type}
        fullWidth={fullWidth}
        size={size}
        isDisabled={isDisabled || isLoading}
        onPress={onPress || onClick}
        variant={variant === 'bordered' ? 'outline' : variant}
        className={className}
      >
        {isLoading && <HeroSpinner aria-hidden="true" color="current" size="sm" />}
        {children}
      </HeroButton>
      <span
        role={isLoading ? 'status' : undefined}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {isLoading ? t.common.loading : ''}
      </span>
    </>
  )
}
