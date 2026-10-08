'use client'

import React from 'react'
import { FormField } from './adapters/hero'
import type { FormFieldProps } from './FormField'

/** Temporary field adapter for unmigrated direct callers. */
export function LegacyHeroField(props: FormFieldProps) {
  const id = React.useId()
  return <FormField {...props} id={props.id ?? id} />
}
