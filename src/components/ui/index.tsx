import React from 'react'

interface ButtonProps {
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

interface InputProps {
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
  name?: string
  variant?: 'default' | 'secondary'
}

export const Input: React.FC<InputProps> = ({
  type = 'text', label, value, onChange, onValueChange,
  isRequired, isDisabled, autoFocus, autoComplete, placeholder, className = '', name,
  variant = 'default',
}) => (
  <div className="w-full">
    {label && <label className="block text-sm font-medium text-gray-600 mb-1">{label}{isRequired ? ' *' : ''}</label>}
    <input
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
  </div>
)

interface CardProps {
  children: React.ReactNode
  className?: string
}

export const Card: React.FC<CardProps> = ({ children, className = '' }) => (
  <div className={`bg-white rounded-2xl shadow-2xl w-full ${className}`} style={{ maxWidth: '400px' }}>
    {children}
  </div>
)

export const CardHeader: React.FC<CardProps> = ({ children, className = '' }) => (
  <div className={`flex flex-col items-center gap-2 pt-8 pb-2 px-6 ${className}`}>{children}</div>
)

export const CardContent: React.FC<CardProps> = ({ children, className = '' }) => (
  <div className={`px-6 pb-4 ${className}`}>{children}</div>
)

export const CardFooter: React.FC<CardProps> = ({ children, className = '' }) => (
  <div className={`px-6 pb-6 flex justify-center ${className}`}>{children}</div>
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

interface SpinnerProps { size?: 'sm' | 'lg'; className?: string }
export const Spinner: React.FC<SpinnerProps> = ({ size = 'lg', className = '' }) => (
  <div className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${size === 'lg' ? 'w-6 h-6' : 'w-4 h-4'} ${className}`} role="status">
    <span className="sr-only">Loading...</span>
  </div>
)

interface OtpInputProps {
  length?: number
  value: string
  onChange?: (value: string) => void
  onValueChange?: (value: string) => void
  isDisabled?: boolean
  autoFocus?: boolean
}

export const OtpInput: React.FC<OtpInputProps> = ({
  length = 6, value, onChange, onValueChange, isDisabled, autoFocus,
}) => {
  const setValue = onChange || onValueChange || (() => {})
  const inputs = Array.from({ length }, (_, i) => i)

  return (
    <div className="flex justify-center gap-2">
      {inputs.map(i => (
        <input
          key={i}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ''}
          disabled={isDisabled}
          autoFocus={autoFocus && i === 0}
          onChange={e => {
            const char = e.target.value.replace(/[^0-9]/g, '').slice(0, 1)
            const newVal = value.split('')
            newVal[i] = char
            setValue(newVal.join(''))
            // Auto-focus next
            if (char && i < length - 1) {
              const next = e.target.parentElement?.nextElementSibling?.querySelector('input')
              next?.focus()
            }
          }}
          onKeyDown={e => {
            if (e.key === 'Backspace' && !value[i] && i > 0) {
              const prev = (e.target as HTMLElement).parentElement?.previousElementSibling?.querySelector('input')
              prev?.focus()
            }
          }}
          className="w-12 h-14 text-center text-2xl font-semibold text-gray-900 border-2 border-gray-300 rounded-xl focus:border-[#D5E855] focus:ring-2 focus:ring-[#D5E855]/30 outline-none transition-all bg-white"
        />
      ))}
    </div>
  )
}