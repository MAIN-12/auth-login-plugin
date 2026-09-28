'use client'

import React from 'react'
import { Modal } from '@heroui/react'
import type { AuthModalProps } from './AuthModal'

export default function AuthModalHero({ children, onClose, label, closeLabel }: AuthModalProps) {
  // Outside scrolling makes the full-height container a pointer target too.
  // Only dismiss clicks on empty overlay surfaces, never dialog descendants.
  const dismissOutside = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target
    if (target === event.currentTarget ||
      (target instanceof HTMLElement && target.dataset.slot === 'modal-container')) onClose()
  }
  return (
    <Modal.Backdrop isOpen isDismissable onClick={dismissOutside} onOpenChange={open => { if (!open) onClose() }}>
      <Modal.Container size="md" placement="center" scroll="outside">
        <Modal.Dialog aria-label={label} className="light relative bg-white p-2 text-gray-900" data-theme="light" style={{ colorScheme: 'light' }}>
          <Modal.CloseTrigger aria-label={closeLabel} />
          {children}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
