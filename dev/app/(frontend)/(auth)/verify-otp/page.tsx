'use client'

import { VerifyOtpPage } from '@main12/auth-login/client'
import Logo from '../../../../components/Logo'

export default function DevVerifyOtpPage() {
  return (
    <VerifyOtpPage
      loginUrl="/login"
      logo={<Logo />}
    />
  )
}