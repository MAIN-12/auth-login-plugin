'use client'

import React, { useState } from 'react'
import { Modal } from '@heroui/react'
import type { AuthModalProps } from '../types'

export default function AuthModalHero({ children, onClose, label, closeLabel }: AuthModalProps) {
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null)
  // Keep the portal in its application ancestry so scoped CSS tokens inherit.
  // Outside scrolling makes the full-height container a pointer target too.
  // Only dismiss clicks on empty overlay surfaces, never dialog descendants.
  const dismissOutside = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target
    if (
      target === event.currentTarget ||
      (target instanceof HTMLElement && target.dataset.slot === 'modal-container')
    )
      onClose()
  }
  return (
    <>
      <div ref={setPortalContainer} style={{ display: 'contents' }} />
      {portalContainer && (
        <Modal.Backdrop
          UNSTABLE_portalContainer={portalContainer}
          isOpen
          isDismissable
          onClick={dismissOutside}
          onOpenChange={(open) => {
            if (!open) onClose()
          }}
        >
          <Modal.Container size="md" placement="center" scroll="outside">
            <Modal.Dialog aria-label={label} className="relative p-2">
              <Modal.CloseTrigger aria-label={closeLabel} />
              {children}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      )}
    </>
  )
}
