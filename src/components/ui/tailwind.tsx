'use client'

import { useAuthTranslations } from '../auth-presentation/AuthPresentationContext'
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
  children, type = 'button', fullWidth = true, size = 'lg',
  isLoading, isDisabled, onPress, onClick, variant = 'primary', className = '',
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
  type?: string
  label?: string
  value: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  onValueChange?: (value: string) => void
  isRequired?: boolean
  isDisabled?: boolean
  autoFocus?: boolean
  autoComplete?: string
  placeholder?: string
  className?: string
  error?: string | null
  name?: string
  variant?: 'default' | 'secondary'
}

export const Input: React.FC<InputProps> = ({
  type = 'text', label, value, onChange, onValueChange,
  isRequired, isDisabled, autoFocus, autoComplete, placeholder, className = '', name, error,
  variant = 'default',
}) => {
  const inputId = React.useId()
  return (
  <div className="w-full">
    {label && <label htmlFor={inputId} className="block text-sm font-medium text-gray-600 mb-1">{label}{isRequired ? ' *' : ''}</label>}
    <input
      id={inputId}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? `${inputId}-error` : undefined}
      type={type}
      value={value}
      onChange={onChange || (onValueChange ? e => onValueChange(e.target.value) : undefined)}
      required={isRequired}
      disabled={isDisabled}
      autoFocus={autoFocus}
      autoComplete={autoComplete}
      placeholder={placeholder}
      name={name}
      className={`w-full h-12 px-4 ${variant === 'secondary' ? 'bg-gray-100' : 'bg-white'} border border-gray-300 hover:border-gray-400 rounded-xl text-gray-900 text-base transition-colors outline-none focus:border-[#D5E855] focus:ring-2 focus:ring-[#D5E855]/30 ${className}`}
    />
    {error && <span id={`${inputId}-error`} className="sr-only">{error}</span>}
  </div>
  )
}

export interface CardProps {
  children: React.ReactNode
  className?: string
}

export const Card: React.FC<CardProps> = ({ children, className = '' }) => (
  <div
    className={`bg-white text-gray-900 rounded-2xl shadow-2xl w-full light [color-scheme:light] ${className}`}
    data-theme="light"
    style={{ maxWidth: '448px' }}
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

export interface SpinnerProps { size?: 'sm' | 'lg'; className?: string }
export const Spinner: React.FC<SpinnerProps> = ({ size = 'lg', className = '' }) => (
  <div className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${size === 'lg' ? 'w-6 h-6' : 'w-4 h-4'} ${className}`} role="status">
    <span className="sr-only">{useAuthTranslations().common.loading}</span>
  </div>
)

export interface OtpInputProps {
  length?: number
  value: string
  onChange?: (value: string) => void
  onValueChange?: (value: string) => void
  isDisabled?: boolean
  autoFocus?: boolean
  error?: string | null
  locale?: string
}

export const OtpInput: React.FC<OtpInputProps> = ({
  length = 6, value, onChange, onValueChange, isDisabled, autoFocus, error, locale,
}) => {
  const t = useAuthTranslations(locale).verifyOtp
  const description = React.useId()
  const positions = value.padEnd(length, ' ').slice(0, length).split('')
  const setValue = onChange || onValueChange || (() => {})
  const inputs = Array.from({ length }, (_, i) => i)
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([])

  const focusInput = (index: number) => {
    inputRefs.current[index]?.focus()
    inputRefs.current[index]?.select()
  }

  return (
    <div role="group" aria-label={t.codeLabel} className="flex w-full justify-center gap-2">
      {inputs.map(i => (
        <input
          key={i}
          ref={el => { inputRefs.current[i] = el }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={length}
          aria-label={t.digitLabel.replace('{position}', String(i + 1)).replace('{length}', String(length))}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? description : undefined}
          value={positions[i].trim()}
          disabled={isDisabled}
          autoFocus={autoFocus && i === 0}
          onChange={e => {
            const digits = e.target.value.replace(/[^0-9]/g, '')
            if (digits.length > 1) { setValue(digits.slice(0, length).padEnd(length, ' ')); focusInput(Math.min(digits.length, length - 1)); return }
            const char = digits.slice(-1)
            const newVal = [...positions]
            newVal[i] = char || ' '
            setValue(newVal.join('').slice(0, length))
            // Auto-focus next input once a digit is entered
            if (char && i < length - 1) {
              focusInput(i + 1)
            }
          }}
          onKeyDown={e => {
            if (e.key === 'Backspace') {
              if (positions[i].trim()) { e.preventDefault(); const updated = [...positions]; updated[i] = ' '; setValue(updated.join('')); return }
              if (!positions[i].trim() && i > 0) {
                // Empty box — move to previous box and clear it
                e.preventDefault()
                const newVal = [...positions]
                newVal[i - 1] = ' '
                setValue(newVal.join(''))
                focusInput(i - 1)
              }
            } else if (e.key === 'ArrowLeft' && i > 0) {
              e.preventDefault()
              focusInput(i - 1)
            } else if (e.key === 'ArrowRight' && i < length - 1) {
              e.preventDefault()
              focusInput(i + 1)
            }
          }}
          onPaste={e => {
            e.preventDefault()
            const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, length)
            if (!pasted) return
            setValue(pasted.padEnd(length, ' '))
            const nextIndex = Math.min(pasted.length, length - 1)
            focusInput(nextIndex)
          }}
          onFocus={e => e.target.select()}
          className="w-12 min-w-0 h-14 text-center text-2xl font-semibold text-gray-900 border-2 border-gray-300 rounded-xl focus:border-[#D5E855] focus:ring-2 focus:ring-[#D5E855]/30 outline-none transition-all bg-white"
        />
      ))}
      {error && <span id={description} className="sr-only">{error}</span>}
    </div>
  )
}