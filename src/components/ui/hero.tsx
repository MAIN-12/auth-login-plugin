'use client'

import React from 'react'
import { Button as HeroButton, Input as HeroInput, TextField, Label, Card as HeroCard, Separator, Spinner as HeroSpinner, InputOTP } from '@heroui/react'
import type { ButtonProps, InputProps, CardProps, SpinnerProps, OtpInputProps } from './tailwind'

export function Button({ children, type = 'button', fullWidth = true, size = 'lg', isLoading, isDisabled, onPress, onClick, variant = 'primary', className }: ButtonProps) {
  return <HeroButton type={type} fullWidth={fullWidth} size={size} isPending={isLoading} isDisabled={isDisabled}
    onPress={onPress || onClick} variant={variant === 'bordered' ? 'outline' : variant} className={className}>
    {isLoading && <HeroSpinner color="current" size="sm" />}{children}
  </HeroButton>
}

export function Input({ label, value, onChange, onValueChange, className, variant = 'default', ...props }: InputProps) {
  return <TextField {...props} value={value} onChange={onChange ? undefined : onValueChange} fullWidth className={className}>
    {label && <Label>{label}</Label>}
    <HeroInput onChange={onChange} variant={variant === 'default' ? 'primary' : variant} />
  </TextField>
}

export const Card = ({ children, className = '' }: CardProps) => <HeroCard className={`w-full ${className}`} style={{ maxWidth: '400px' }}>{children}</HeroCard>
export const CardHeader = (props: CardProps) => <HeroCard.Header {...props} />
export const CardContent = (props: CardProps) => <HeroCard.Content {...props} />
export const CardFooter = (props: CardProps) => <HeroCard.Footer {...props} />
export const CardTitle = (props: CardProps) => <HeroCard.Title {...props} />
export const CardDescription = (props: CardProps) => <HeroCard.Description {...props} />
export const Divider = (props: { className?: string }) => <Separator {...props} />
export const Spinner = (props: SpinnerProps) => <HeroSpinner {...props} />
export function OtpInput({ length = 6, value, onChange, onValueChange, isDisabled, autoFocus }: OtpInputProps) {
  return <InputOTP maxLength={length} value={value} onChange={onChange || onValueChange} isDisabled={isDisabled} autoFocus={autoFocus} pattern="^\d+$" variant="secondary" aria-label="Verification code">
    <InputOTP.Group>{Array.from({ length }, (_, index) => <InputOTP.Slot key={index} index={index} />)}</InputOTP.Group>
  </InputOTP>
}
