import type { InputProps } from '../atoms/adapters/tailwind'

export interface FormFieldProps extends InputProps {
  label?: string
  help?: string
  error?: string | null
}
export interface ResolvedFormFieldProps extends FormFieldProps {
  id: string
}
/** Caller descriptions compose with help and server-error descriptions. */
export function fieldDescriptions({
  id,
  help,
  error,
  'aria-describedby': describedBy,
}: ResolvedFormFieldProps) {
  return (
    [describedBy, help ? `${id}-help` : undefined, error ? `${id}-error` : undefined]
      .filter(Boolean)
      .join(' ') || undefined
  )
}
