'use client'
import { withAuthStyle } from '../../../hoc/withAuthStyle'
import { Input as TailwindInput } from './Tailwind'
import type { InputProps } from './types'
export type { InputProps } from './types'
export const Input = withAuthStyle<InputProps>(TailwindInput, () =>
  import('./Hero').then((module) => ({ default: module.Input })),
)
