'use client'

import { useAuthTranslations } from '../../auth-presentation/AuthPresentationContext'
import React from 'react'

export interface ButtonProps {
  children: React.ReactNode
  type?: 'button' | 'submit'
  fullWidth?: boolean
  size?: 'sm' | 'lg'
  isLoading?: boolean
  isDisabled?: boolean
  onPress?: () => void
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'bordered' | 'ghost' | 'tertiary'
  className?: string
}

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

export interface InputProps {
  id?: string
  type?: string
  value: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  onValueChange?: (value: string) => void
  isRequired?: boolean
  isDisabled?: boolean
  autoFocus?: boolean
  autoComplete?: string
  placeholder?: string
  className?: string
  name?: string
  variant?: 'default' | 'secondary'
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  'aria-label'?: string
  'aria-labelledby'?: string
}

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

export interface CardProps {
  children: React.ReactNode
  className?: string
}

export const Card: React.FC<CardProps> = ({ children, className = '' }) => (
  <div
    className={`bg-white text-gray-900 rounded-2xl shadow-2xl w-full light [color-scheme:light] ${className}`}
    data-theme="light"
    style={{ maxWidth: '400px' }}
  >
    {children}
  </div>
)

export const CardHeader: React.FC<CardProps> = ({ children, className = '' }) => (
  <div className={`flex flex-col items-center gap-2 pt-8 pb-4 px-8 ${className}`}>{children}</div>
)

export const CardContent: React.FC<CardProps> = ({ children, className = '' }) => (
  <div className={`px-8 pb-6 ${className}`}>{children}</div>
)

export const CardFooter: React.FC<CardProps> = ({ children, className = '' }) => (
  <div className={`px-8 pb-8 flex justify-center ${className}`}>{children}</div>
)

export const CardTitle: React.FC<CardProps> = ({ children, className = '' }) => (
  <h1 className={`text-xl font-semibold text-gray-900 ${className}`}>{children}</h1>
)

export const CardDescription: React.FC<CardProps> = ({ children, className = '' }) => (
  <p className={`text-gray-600 text-sm text-center ${className}`}>{children}</p>
)

export const Divider: React.FC<{ className?: string }> = ({ className = '' }) => (
  <hr className={`border-0 h-px bg-gray-200 ${className}`} />
)

export interface SpinnerProps {
  size?: 'sm' | 'lg'
  className?: string
}
export const Spinner: React.FC<SpinnerProps> = ({ size = 'lg', className = '' }) => (
  <div
    className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${size === 'lg' ? 'w-6 h-6' : 'w-4 h-4'} ${className}`}
    role="status"
  >
    <span className="sr-only">{useAuthTranslations().common.loading}</span>
  </div>
)
