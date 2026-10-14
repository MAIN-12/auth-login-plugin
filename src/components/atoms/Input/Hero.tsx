'use client'
import React from 'react'
import type { InputProps } from './types'
import { Input as HeroInput } from '@heroui/react'
export function Input({
  value,
  onChange,
  onValueChange,
  isRequired,
  isDisabled,
  variant = 'default',
  'aria-invalid': invalid,
  ...props
}: InputProps) {
  return (
    <HeroInput
      {...props}
      aria-invalid={invalid}
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
