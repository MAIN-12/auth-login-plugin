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
