'use client'
import { withAuthStyle } from '../../../hoc/withAuthStyle'
import { Spinner as TailwindSpinner } from './Tailwind'
import type { SpinnerProps } from './types'
export type { SpinnerProps } from './types'
export const Spinner = withAuthStyle<SpinnerProps>(TailwindSpinner, () =>
  import('./Hero').then((module) => ({ default: module.Spinner })),
)
