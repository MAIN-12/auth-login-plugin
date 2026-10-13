'use client'

import { useState } from 'react'
import { Modal } from '@heroui/react'

export function CustomizationHelp({ title, note }: { title: string; note: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-200/50 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-500"
      >
        Customization
      </button>
      {open && (
        <Modal.Backdrop
          isOpen={open}
          onOpenChange={setOpen}
          isDismissable
          className="fixed inset-0 z-[100] bg-black/40"
        >
          <Modal.Container
            size="md"
            placement="center"
            scroll="outside"
            className="flex min-h-dvh items-center justify-center p-4"
          >
            <Modal.Dialog
              aria-label="Email customization"
              className="light relative w-full max-w-[480px] rounded-3xl bg-white p-6 text-zinc-900 sm:p-8"
              data-theme="light"
              style={{ colorScheme: 'light' }}
            >
              <Modal.CloseTrigger
                aria-label="Close customization help"
                className="absolute right-3 top-3"
              />
              <Modal.Heading className="pr-6 text-xl font-semibold">
                Customize your emails
              </Modal.Heading>
              <div className="mt-6 space-y-5 text-sm leading-6 text-zinc-500">
                <div>
                  <h3 className="font-medium text-zinc-900">Design and wording</h3>
                  <p className="mt-1">
                    Edit{' '}
                    <code className="break-all text-xs text-zinc-700">
                      dev/examples/auth-emails.ts
                    </code>
                    , then select Project to preview your changes.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-zinc-900">Use in your project</h3>
                  <p className="mt-1">
                    Pass <code className="text-xs text-zinc-700">emails: projectAuthEmails</code> to{' '}
                    <code className="text-xs text-zinc-700">authLoginPlugin</code> to use your
                    custom emails.
                  </p>
                </div>
                <div className="border-t border-zinc-100 pt-5">
                  <h3 className="font-medium text-zinc-900">{title}</h3>
                  <p className="mt-1">{note}</p>
                </div>
                <p className="text-xs leading-5">
                  Email apps may render differently. Send a test to check the result in your inbox.
                </p>
              </div>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      )}
    </>
  )
}
