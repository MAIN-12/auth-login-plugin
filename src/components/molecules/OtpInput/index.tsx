'use client'

import { withAuthStyle } from '../../../hoc/withAuthStyle'
import { OtpInput as TailwindOtpInput } from './Tailwind'
import type { OtpInputProps } from './types'
export type { OtpInputProps } from './types'

export const OtpInput = withAuthStyle<OtpInputProps>(TailwindOtpInput, () =>
  import('./Hero').then((module) => ({ default: module.OtpInput })),
)
