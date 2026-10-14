'use client'

import React from 'react'
import { withAuthStyle } from '../../../hoc/withAuthStyle'
import { PasswordField as TailwindPasswordField } from './Tailwind'
import type { PasswordFieldProps, ResolvedPasswordFieldProps } from './types'

const StyledPasswordField = withAuthStyle<ResolvedPasswordFieldProps>(TailwindPasswordField, () =>
  import('./Hero').then((module) => ({ default: module.PasswordField })),
)

/** Controlled visibility is shared; each visual adapter owns its native input composition. */
export function PasswordField(props: PasswordFieldProps) {
  const generatedId = React.useId()
  return <StyledPasswordField {...props} id={props.id ?? generatedId} />
}
