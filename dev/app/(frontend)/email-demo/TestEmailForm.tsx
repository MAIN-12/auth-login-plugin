'use client'

import { useRef, useState, type FormEvent } from 'react'
import { Button, Input, Label, Modal, TextField } from '@heroui/react'
import { sendTestEmail } from './actions'

export function TestEmailForm({
  template,
  title,
  design,
  enabled,
}: {
  template: string
  title: string
  design: 'default' | 'custom'
  enabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const busy = useRef(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current || !enabled) return
    busy.current = true
    setSending(true)
    setResult(null)
    try {
      setResult(await sendTestEmail({ template, design, name, email }))
    } catch {
      setResult({ success: false, message: 'Could not reach the server. Please try again.' })
    } finally {
      busy.current = false
      setSending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setResult(null)
          setOpen(true)
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-zinc-200 bg-white px-3.5 text-sm font-medium leading-none text-zinc-700 shadow-xs transition-colors hover:border-zinc-300 hover:bg-zinc-50 active:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!enabled}
        title={!enabled ? 'Test sending is available in development' : undefined}
      >
        <span>Send test email</span>
      </button>
      {open && (
        <Modal.Backdrop
          isOpen={open}
          onOpenChange={(nextOpen) => {
            if (!busy.current) setOpen(nextOpen)
          }}
          isDismissable={!sending}
          isKeyboardDismissDisabled={sending}
          className="fixed inset-0 z-[100] bg-black/40"
        >
          <Modal.Container
            size="md"
            placement="center"
            scroll="outside"
            className="flex min-h-dvh items-center justify-center p-4"
          >
            <Modal.Dialog
              aria-label="Send a test email"
              className="light relative w-[calc(100%_-_2rem)] max-w-[440px] rounded-3xl bg-white p-6 text-zinc-900 sm:p-8"
              data-theme="light"
              style={{ colorScheme: 'light' }}
            >
              <Modal.CloseTrigger
                aria-label="Close test email"
                isDisabled={sending}
                className="absolute right-3 top-3"
              />
              <Modal.Heading className="pr-6 text-xl font-semibold">
                Send a test email
              </Modal.Heading>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Preview <span className="font-medium text-zinc-700">{title}</span> in your inbox,
                using the {design === 'custom' ? 'project' : 'plugin'} design.
              </p>
              <form onSubmit={submit} className="mt-6 space-y-4">
                <TextField
                  name="name"
                  value={name}
                  onChange={setName}
                  isRequired
                  isDisabled={sending}
                >
                  <Label>Your name</Label>
                  <Input
                    variant="secondary"
                    autoComplete="name"
                    placeholder="Alex Morgan"
                    maxLength={100}
                    autoFocus
                  />
                </TextField>
                <TextField
                  name="email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  isRequired
                  isDisabled={sending}
                >
                  <Label>Email address</Label>
                  <Input
                    variant="secondary"
                    autoComplete="email"
                    placeholder="you@example.com"
                    maxLength={254}
                  />
                </TextField>
                <p className="text-xs leading-5 text-zinc-500">
                  Codes are sample values and cannot sign you in. No account is created or changed.
                </p>
                {result && (
                  <p
                    role={result.success ? 'status' : 'alert'}
                    className={`text-sm ${result.success ? 'text-green-700' : 'text-red-700'}`}
                  >
                    {result.message}
                  </p>
                )}
                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    isDisabled={sending}
                    onPress={() => setOpen(false)}
                  >
                    {result?.success ? 'Done' : 'Cancel'}
                  </Button>
                  <Button type="submit" isDisabled={sending || !enabled} isPending={sending}>
                    {sending ? 'Sending…' : 'Send test email'}
                  </Button>
                </div>
              </form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      )}
    </>
  )
}
