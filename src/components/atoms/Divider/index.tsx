'use client'
import { withAuthStyle } from '../../../hoc/withAuthStyle'
import { Divider as TailwindDivider } from './Tailwind'
import type { DividerProps } from './types'
export type { DividerProps } from './types'
export const Divider = withAuthStyle<DividerProps>(TailwindDivider, () =>
  import('./Hero').then((module) => ({ default: module.Divider })),
)
