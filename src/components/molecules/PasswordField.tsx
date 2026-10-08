'use client'

import React from 'react'
import { FormField, type FormFieldProps } from './FormField'

/** Existing login interaction: masked control, no new visibility workflow. */
export function PasswordField(props: Omit<FormFieldProps, 'type'>) {
  return <FormField {...props} type="password" />
}
