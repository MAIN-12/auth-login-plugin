'use client'

import { SetPasswordPage } from '@main12/auth-login/client'
import Logo from '../../../../components/Logo'

export default function DevSetPasswordPage() {
  return (
    <SetPasswordPage
      redirectTo="/admin"
      logo={<Logo />}
    />
  )
}