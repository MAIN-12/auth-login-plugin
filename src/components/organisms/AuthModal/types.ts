import type React from 'react'

export interface AuthModalProps {
  children: React.ReactNode
  onClose: () => void
  label: string
  closeLabel: string
}
