'use client'
import React from 'react'
import type { InputProps } from './types'
export const Input: React.FC<InputProps> = ({
  value,
  onChange,
  onValueChange,
  isRequired,
  isDisabled,
  variant = 'default',
  className = '',
  type = 'text',
  ...props
}) => (
  <input
    {...props}
    type={type}
    value={value}
    onChange={onChange || (onValueChange ? (e) => onValueChange(e.target.value) : undefined)}
    required={isRequired}
    disabled={isDisabled}
    className={`w-full h-12 px-4 ${variant === 'secondary' ? 'bg-gray-100' : 'bg-white'} border border-gray-300 hover:border-gray-400 rounded-xl text-gray-900 text-base transition-colors outline-none focus:border-[#D5E855] focus:ring-2 focus:ring-[#D5E855]/30 ${className}`}
  />
)
