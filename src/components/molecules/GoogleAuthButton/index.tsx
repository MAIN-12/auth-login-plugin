'use client'

import React from 'react'
import { Button } from '../../atoms'
import { GoogleIcon } from '../../atoms/GoogleIcon'

/** Presentation only: its caller owns method admission and the Google action. */
export function GoogleAuthButton({ children, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      fullWidth
      size="lg"
      variant="secondary"
      className="mb-4 [--button-fg:var(--foreground)]"
      {...props}
    >
      <GoogleIcon />
      {children}
    </Button>
  )
}
