'use client'

import { useState } from 'react'
import { isAuthEmailValid } from '../formValidation'

/** Empty pristine fields are quiet; edited invalid fields get immediate localized feedback. */
export function useEmailField() {
  const [email, updateEmail] = useState('')
  const [edited, setEdited] = useState(false)
  const isEmailValid = isAuthEmailValid(email)

  return {
    email,
    isEmailValid,
    emailError: edited && !isEmailValid ? 'invalidEmail' : null,
    setEmail: (value: string) => {
      setEdited(true)
      updateEmail(value)
    },
  }
}
