'use client'

import React from 'react'
import { FormField } from './adapters/tailwind'
import type { FormFieldProps } from './FormField'

/** Temporary field adapter for unmigrated direct callers. */
export function LegacyTailwindField(props: FormFieldProps) {
  const id = React.useId()
  return <FormField {...props} id={props.id ?? id} />
}
