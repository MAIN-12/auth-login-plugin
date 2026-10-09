import type React from 'react'

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
