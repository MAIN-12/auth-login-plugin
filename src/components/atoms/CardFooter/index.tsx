'use client'
import { withAuthStyle } from '../../../hoc/withAuthStyle'
import { CardFooter as TailwindCardFooter } from './Tailwind'
import type { CardProps } from './types'
export type { CardProps } from './types'
export const CardFooter = withAuthStyle<CardProps>(TailwindCardFooter, () =>
  import('./Hero').then((module) => ({ default: module.CardFooter })),
)
