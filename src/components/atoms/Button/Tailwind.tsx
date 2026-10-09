'use client'
import React from 'react'
import type { ButtonProps } from './types'
import { Spinner } from '../Spinner/Tailwind'
const variantClasses: Record<string, string> = {
  primary: 'bg-[#D5E855] text-gray-900 hover:bg-[#C9DC4A] font-semibold',
  secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 font-medium',
  bordered: 'border border-gray-300 text-gray-700 hover:bg-gray-50 bg-white',
  ghost: 'text-gray-600 hover:text-gray-900 bg-transparent',
  tertiary: 'text-gray-600 hover:text-gray-900 bg-transparent underline',
}

export const Button: React.FC<ButtonProps> = ({
  children,
  type = 'button',
  fullWidth = true,
  size = 'lg',
  isLoading,
  isDisabled,
  onPress,
  onClick,
  variant = 'primary',
  className = '',
}) => (
  <button
    type={type}
    disabled={isDisabled || isLoading}
    onClick={onPress || onClick}
    className={`
      ${fullWidth ? 'w-full' : ''}
      ${size === 'lg' ? 'h-12 px-6 text-base' : 'h-8 px-3 text-sm'}
      rounded-full transition-all duration-200 flex items-center justify-center gap-2
      disabled:opacity-50 disabled:cursor-not-allowed
      ${variantClasses[variant] || variantClasses.primary}
      ${className}
    `.trim()}
  >
    {isLoading ? <Spinner size="sm" /> : null}
    {children}
  </button>
)
