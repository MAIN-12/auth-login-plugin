'use client'

import React from 'react'
import { Input } from '../../atoms/Input/Tailwind'
import { fieldDescriptions, type ResolvedFormFieldProps } from './types'

export function FormField({ label, help, error, ...props }: ResolvedFormFieldProps) {
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={props.id} className="block text-sm font-medium text-gray-600 mb-1">
          {label}
          {props.isRequired ? ' *' : ''}
        </label>
      )}
      <Input
        {...props}
        className={`${props.className ?? ''} ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : ''}`}
        aria-invalid={Boolean(error) || Boolean(props['aria-invalid'])}
        aria-describedby={fieldDescriptions({ ...props, help, error })}
      />
      {help && (
        <span id={`${props.id}-help`} className="block text-sm text-gray-600">
          {help}
        </span>
      )}
      {error && (
        <span id={`${props.id}-error`} className="block text-sm text-red-600 mt-1">
          {error}
        </span>
      )}
    </div>
  )
}
