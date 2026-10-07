'use client'

import React from 'react'
import { useAuthTranslations } from '../auth-presentation/AuthPresentationContext'
import {
  Button as HeroButton,
  Input as HeroInput,
  TextField,
  Label,
  Card as HeroCard,
  Separator,
  Spinner as HeroSpinner,
} from '@heroui/react'
import { OtpInput as PositionalOtpInput } from './tailwind'
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
  label,
  value,
  onChange,
  onValueChange,
  className,
  variant = 'default',
  error,
  ...props
}: InputProps) {
  const errorId = React.useId()
  return (
    <TextField
      {...props}
      validationBehavior="aria"
      isInvalid={Boolean(error)}
      value={value}
      onChange={onChange ? undefined : onValueChange}
      fullWidth
      className={className}
    >
      {label && <Label>{label}</Label>}
      {error && (
        <span id={errorId} className="sr-only">
          {error}
        </span>
      )}
      <HeroInput
        required={props.isRequired}
        aria-describedby={error ? errorId : undefined}
        onChange={onChange}
        variant={variant === 'default' ? 'primary' : variant}
      />
    </TextField>
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
/** Same positional keyboard/autofill behavior for both style adapters. */
export const OtpInput = PositionalOtpInput
