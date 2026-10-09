'use client'

import React from 'react'
import { useAuthPresentation, useAuthTranslations } from '../../../contexts/AuthAppearanceContext'

export interface OtpInputProps {
  length?: number
  value: string
  onChange?: (value: string) => void
  onValueChange?: (value: string) => void
  isDisabled?: boolean
  autoFocus?: boolean
  error?: string | null
  locale?: string
}

export const OtpInput: React.FC<OtpInputProps> = ({
  length = 6,
  value,
  onChange,
  onValueChange,
  isDisabled,
  autoFocus,
  error,
  locale,
}) => {
  const { style } = useAuthPresentation()
  const t = useAuthTranslations(locale).verifyOtp
  const description = React.useId()
  const positions = value.padEnd(length, ' ').slice(0, length).split('')
  const setValue = onChange || onValueChange || (() => {})
  const inputs = Array.from({ length }, (_, i) => i)
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([])

  const focusInput = (index: number) => {
    inputRefs.current[index]?.focus()
    inputRefs.current[index]?.select()
  }

  return (
    <div role="group" aria-label={t.codeLabel} className="flex w-full justify-center gap-2">
      {inputs.map((i) => (
        <input
          key={i}
          ref={(el) => {
            inputRefs.current[i] = el
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={length}
          aria-label={t.digitLabel
            .replace('{position}', String(i + 1))
            .replace('{length}', String(length))}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? description : undefined}
          value={positions[i].trim()}
          disabled={isDisabled}
          autoFocus={autoFocus && i === 0}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^0-9]/g, '')
            if (digits.length > 1) {
              setValue(digits.slice(0, length).padEnd(length, ' '))
              focusInput(Math.min(digits.length, length - 1))
              return
            }
            const char = digits.slice(-1)
            const newVal = [...positions]
            newVal[i] = char || ' '
            setValue(newVal.join('').slice(0, length))
            // Auto-focus next input once a digit is entered
            if (char && i < length - 1) {
              focusInput(i + 1)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              if (positions[i].trim()) {
                e.preventDefault()
                const updated = [...positions]
                updated[i] = ' '
                setValue(updated.join(''))
                return
              }
              if (!positions[i].trim() && i > 0) {
                // Empty box — move to previous box and clear it
                e.preventDefault()
                const newVal = [...positions]
                newVal[i - 1] = ' '
                setValue(newVal.join(''))
                focusInput(i - 1)
              }
            } else if (e.key === 'ArrowLeft' && i > 0) {
              e.preventDefault()
              focusInput(i - 1)
            } else if (e.key === 'ArrowRight' && i < length - 1) {
              e.preventDefault()
              focusInput(i + 1)
            }
          }}
          onPaste={(e) => {
            e.preventDefault()
            const pasted = e.clipboardData
              .getData('text')
              .replace(/[^0-9]/g, '')
              .slice(0, length)
            if (!pasted) return
            setValue(pasted.padEnd(length, ' '))
            const nextIndex = Math.min(pasted.length, length - 1)
            focusInput(nextIndex)
          }}
          onFocus={(e) => e.target.select()}
          className={`w-12 min-w-0 h-14 text-center text-2xl font-semibold border-2 rounded-xl outline-none transition-all ${style === 'hero-ui' ? 'input input--primary text-field-foreground bg-field border-field focus:border-focus focus:ring-2 focus:ring-focus aria-[invalid=true]:border-danger' : 'text-gray-900 border-gray-300 focus:border-[#D5E855] focus:ring-2 focus:ring-[#D5E855]/30 bg-white'}`}
        />
      ))}
      {error && (
        <span id={description} className="sr-only">
          {error}
        </span>
      )}
    </div>
  )
}
