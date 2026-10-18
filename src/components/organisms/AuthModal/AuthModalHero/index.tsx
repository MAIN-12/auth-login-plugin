'use client'

import React, { useState } from 'react'
import { Modal } from '@heroui/react'
import type { AuthModalProps } from '../types'

export default function AuthModalHero({
  children,
  onClose,
  label,
  closeLabel,
  hideCloseButton = false,
}: AuthModalProps) {
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
            <Modal.Dialog
              aria-label={label}
              className="relative"
              style={{
                maxWidth: 400,
                padding: hideCloseButton ? 0 : '48px 0 0',
                background: 'transparent',
                border: 0,
                boxShadow: 'none',
              }}
            >
              {!hideCloseButton && (
                <Modal.CloseTrigger
                  aria-label={closeLabel}
                  style={{
                    top: 0,
                    right: 0,
                    zIndex: 10,
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: 'rgba(0, 0, 0, 0.7)',
                    color: 'white',
                  }}
                />
              )}
              {children}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      )}
    </>
  )
}
