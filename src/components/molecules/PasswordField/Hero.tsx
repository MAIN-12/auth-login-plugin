'use client'

import React from 'react'
import { Button, FieldError, InputGroup, Label, TextField } from '@heroui/react'
import { fieldDescriptions } from '../FormField/types'
import type { ResolvedPasswordFieldProps } from './types'
import { VisibilityIcon } from './VisibilityIcon'

export function PasswordField({
  visible = false,
  onToggleVisibility,
  visibilityLabel,
  label,
  help,
  error,
  onValueChange,
  onChange,
  isRequired,
  isDisabled,
  variant = 'default',
  className,
  ...props
}: ResolvedPasswordFieldProps) {
  return (
    <TextField
      validationBehavior="aria"
      isInvalid={Boolean(error) || Boolean(props['aria-invalid'])}
      isDisabled={isDisabled}
      isRequired={isRequired}
      fullWidth
      className={className}
    >
      {label && <Label htmlFor={props.id}>{label}</Label>}
      <InputGroup fullWidth variant={variant === 'default' ? 'primary' : variant}>
        <InputGroup.Input
          {...props}
          type={visible ? 'text' : 'password'}
          onChange={
            onChange || (onValueChange ? (event) => onValueChange(event.target.value) : undefined)
          }
          required={isRequired}
          disabled={isDisabled}
          aria-invalid={Boolean(error) || Boolean(props['aria-invalid'])}
          aria-describedby={fieldDescriptions({ ...props, help, error })}
        />
        {onToggleVisibility && (
          <InputGroup.Suffix>
            <Button
              type="button"
              isIconOnly
              size="sm"
              variant="ghost"
              isDisabled={isDisabled}
              aria-label={visibilityLabel}
              aria-pressed={visible}
              onPress={onToggleVisibility}
            >
              <VisibilityIcon visible={visible} />
            </Button>
          </InputGroup.Suffix>
        )}
      </InputGroup>
      {help && (
        <span id={`${props.id}-help`} className="text-sm text-muted">
          {help}
        </span>
      )}
      {error && <FieldError id={`${props.id}-error`}>{error}</FieldError>}
    </TextField>
  )
}
