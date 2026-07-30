'use client'

import { ForgotPasswordPage } from '@main12/auth-login/client'
import Logo from '../../../../components/Logo'

export default function DevForgotPasswordPage() {
  return (
    <ForgotPasswordPage
      loginUrl="/login"
      logo={<Logo />}
    />
  )
}