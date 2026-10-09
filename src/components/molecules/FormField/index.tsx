'use client'

import React from 'react'
import type { FormFieldProps, ResolvedFormFieldProps } from './types'
export type { FormFieldProps } from './types'
import { withAuthStyle } from '../../../hoc/withAuthStyle'
import { FormField as TailwindFormField } from './Tailwind'

const StyledFormField = withAuthStyle<ResolvedFormFieldProps>(TailwindFormField, () =>
  import('./Hero').then((module) => ({ default: module.FormField })),
)
export function FormField(props: FormFieldProps) {
  const generatedId = React.useId()
  return <StyledFormField {...props} id={props.id ?? generatedId} />
}
