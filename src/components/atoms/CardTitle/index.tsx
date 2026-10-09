'use client'
import { withAuthStyle } from '../../../hoc/withAuthStyle'
import { CardTitle as TailwindCardTitle } from './Tailwind'
import type { CardProps } from './types'
export type { CardProps } from './types'
export const CardTitle = withAuthStyle<CardProps>(TailwindCardTitle, () =>
  import('./Hero').then((module) => ({ default: module.CardTitle })),
)
