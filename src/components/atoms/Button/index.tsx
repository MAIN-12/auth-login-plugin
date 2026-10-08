'use client'
import { withAuthStyle } from '../../../hoc/withAuthStyle'
import { Button as TailwindButton } from './Tailwind'
import type { ButtonProps } from './types'
export type { ButtonProps } from './types'
export const Button = withAuthStyle<ButtonProps>(TailwindButton, () =>
  import('./Hero').then((module) => ({ default: module.Button })),
)
