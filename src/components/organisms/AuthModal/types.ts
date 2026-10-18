import type React from 'react'

export interface AuthModalProps {
  children: React.ReactNode
  onClose: () => void
  label: string
  /** Hide the close button; outside-click and Escape dismissal remain enabled. */
  hideCloseButton?: boolean
  closeLabel: string
}
