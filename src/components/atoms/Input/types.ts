import type React from 'react'

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
