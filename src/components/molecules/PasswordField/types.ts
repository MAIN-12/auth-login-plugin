import type { FormFieldProps } from '../FormField/types'

export type PasswordFieldProps = Omit<FormFieldProps, 'type'> & {
  visible?: boolean
  onToggleVisibility?: () => void
  visibilityLabel?: string
}

export type ResolvedPasswordFieldProps = PasswordFieldProps & { id: string }
