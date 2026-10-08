'use client'
import { withAuthStyle } from '../../../hoc/withAuthStyle'
import { CardDescription as TailwindCardDescription } from './Tailwind'
import type { CardProps } from './types'
export type { CardProps } from './types'
export const CardDescription = withAuthStyle<CardProps>(TailwindCardDescription, () =>
  import('./Hero').then((module) => ({ default: module.CardDescription })),
)
