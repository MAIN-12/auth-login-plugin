'use client'

import React, { lazy } from 'react'
import type { FormFieldProps } from './fieldProps'
export type { FormFieldProps } from './fieldProps'
import { useAuthPresentation } from '../auth-presentation/AuthPresentationContext'
import { VisualLoadingBoundary } from '../auth-presentation/VisualLoadingBoundary'
import { FormField as TailwindFormField } from './adapters/tailwind'

const HeroFormField = lazy(() =>
  import('./adapters/hero').then((module) => ({ default: module.FormField })),
)
export function FormField(props: FormFieldProps) {
  const generatedId = React.useId()
  const { style } = useAuthPresentation()
  const field = { ...props, id: props.id ?? generatedId }
  return style === 'hero-ui' ? (
    <VisualLoadingBoundary>
      <HeroFormField {...field} />
    </VisualLoadingBoundary>
  ) : (
    <TailwindFormField {...field} />
  )
}
