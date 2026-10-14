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
