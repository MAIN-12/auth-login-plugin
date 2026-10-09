'use client'
import { withAuthStyle } from '../../../hoc/withAuthStyle'
import { CardHeader as TailwindCardHeader } from './Tailwind'
import type { CardProps } from './types'
export type { CardProps } from './types'
export const CardHeader = withAuthStyle<CardProps>(TailwindCardHeader, () =>
  import('./Hero').then((module) => ({ default: module.CardHeader })),
)
