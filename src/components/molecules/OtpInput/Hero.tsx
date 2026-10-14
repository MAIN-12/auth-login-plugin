'use client'

import React from 'react'
import { InputOTP, FieldError, REGEXP_ONLY_DIGITS } from '@heroui/react'
import { useAuthTranslations } from '../../../contexts/AuthAppearanceContext'
import type { OtpInputProps } from './types'

/** Native HeroUI has one numeric caret/selection; Tailwind owns positional blank slots. */
export function OtpInput({
  length = 6,
  value,
  onChange,
  onValueChange,
  isDisabled,
  autoFocus,
  error,
  locale,
}: OtpInputProps) {
  const t = useAuthTranslations(locale).verifyOtp
  const description = React.useId()
  const input = React.useRef<HTMLInputElement>(null)
  const digits = value.replace(/[^0-9]/g, '').slice(0, length)
  const setValue = onChange || onValueChange || (() => {})
  const wasDisabled = React.useRef(isDisabled)
  React.useEffect(() => {
    // A failed verification resets and enables the same native input for retry.
    if (autoFocus && wasDisabled.current && !isDisabled) input.current?.focus()
    wasDisabled.current = isDisabled
  }, [autoFocus, isDisabled])

  return (
    <div role="group" aria-label={t.codeLabel}>
      <InputOTP
        ref={input}
        aria-label={t.codeLabel}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? description : undefined}
        maxLength={length}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        isDisabled={isDisabled}
        isInvalid={Boolean(error)}
        value={digits}
        onChange={setValue}
        pattern={REGEXP_ONLY_DIGITS}
        pasteTransformer={(pasted) => pasted.replace(/[^0-9]/g, '')}
        className="flex flex-col items-center gap-2"
      >
        <InputOTP.Group>
          {Array.from({ length }, (_, index) => (
            <InputOTP.Slot key={index} index={index} />
          ))}
        </InputOTP.Group>
        {error && <FieldError id={description}>{error}</FieldError>}
      </InputOTP>
    </div>
  )
}
