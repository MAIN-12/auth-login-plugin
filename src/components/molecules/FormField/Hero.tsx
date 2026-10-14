'use client'

import React from 'react'
import { TextField, Label, FieldError } from '@heroui/react'
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
        aria-invalid={Boolean(error) || Boolean(props['aria-invalid'])}
        aria-describedby={fieldDescriptions({ ...props, help, error })}
      />
      {help && (
        <span id={`${props.id}-help`} className="text-sm text-muted">
          {help}
        </span>
      )}
      {error && <FieldError id={`${props.id}-error`}>{error}</FieldError>}
    </TextField>
  )
}
