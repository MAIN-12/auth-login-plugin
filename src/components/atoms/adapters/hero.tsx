'use client'

import React from 'react'
import { useAuthTranslations } from '../../auth-presentation/AuthPresentationContext'
import {
  Button as HeroButton,
  Input as HeroInput,
  Card as HeroCard,
  Separator,
  Spinner as HeroSpinner,
} from '@heroui/react'
import type { ButtonProps, InputProps, CardProps, SpinnerProps } from './tailwind'

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

export function Input({
  value,
  onChange,
  onValueChange,
  isRequired,
  isDisabled,
  variant = 'default',
  ...props
}: InputProps) {
  return (
    <HeroInput
      {...props}
      value={value}
      onChange={
        onChange || (onValueChange ? (event) => onValueChange(event.target.value) : undefined)
      }
      required={isRequired}
      disabled={isDisabled}
      variant={variant === 'default' ? 'primary' : variant}
    />
  )
}

export const Card = ({ children, className = '' }: CardProps) => (
  <HeroCard className={`w-full ${className}`} style={{ maxWidth: '400px' }}>
    {children}
  </HeroCard>
)
export const CardHeader = (props: CardProps) => <HeroCard.Header {...props} />
export const CardContent = (props: CardProps) => <HeroCard.Content {...props} />
export const CardFooter = (props: CardProps) => <HeroCard.Footer {...props} />
export const CardTitle = (props: CardProps) => <HeroCard.Title {...props} />
export const CardDescription = (props: CardProps) => <HeroCard.Description {...props} />
export const Divider = (props: { className?: string }) => <Separator {...props} />
export const Spinner = (props: SpinnerProps) => <HeroSpinner {...props} />
