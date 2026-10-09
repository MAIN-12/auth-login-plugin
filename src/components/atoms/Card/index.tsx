'use client'
import { withAuthStyle } from '../../../hoc/withAuthStyle'
import { Card as TailwindCard } from './Tailwind'
import type { CardProps } from './types'
export type { CardProps } from './types'
export const Card = withAuthStyle<CardProps>(TailwindCard, () =>
  import('./Hero').then((module) => ({ default: module.Card })),
)
