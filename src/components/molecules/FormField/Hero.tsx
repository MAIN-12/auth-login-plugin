'use client'

import React from 'react'
import { TextField, Label } from '@heroui/react'
import { Input } from '../../atoms/Input/Hero'
import { fieldDescriptions, type ResolvedFormFieldProps } from './types'

export function FormField({ label, help, error, className, ...props }: ResolvedFormFieldProps) {
  return (
    <TextField
      validationBehavior="aria"
      isInvalid={Boolean(error)}
      isDisabled={props.isDisabled}
      isRequired={props.isRequired}
      fullWidth
      className={className}
    >
      {label && <Label htmlFor={props.id}>{label}</Label>}
      <Input
        {...props}
        aria-invalid={Boolean(error) || props['aria-invalid']}
        aria-describedby={fieldDescriptions({ ...props, help, error })}
      />
      {help && (
        <span id={`${props.id}-help`} className="text-sm text-muted">
          {help}
        </span>
      )}
      {error && (
        <span id={`${props.id}-error`} className="sr-only">
          {error}
        </span>
      )}
    </TextField>
  )
}
