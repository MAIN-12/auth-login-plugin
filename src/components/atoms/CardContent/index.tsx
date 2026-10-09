'use client'
import { withAuthStyle } from '../../../hoc/withAuthStyle'
import { CardContent as TailwindCardContent } from './Tailwind'
import type { CardProps } from './types'
export type { CardProps } from './types'
export const CardContent = withAuthStyle<CardProps>(TailwindCardContent, () =>
  import('./Hero').then((module) => ({ default: module.CardContent })),
)
