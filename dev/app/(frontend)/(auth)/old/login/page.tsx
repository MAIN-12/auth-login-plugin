'use client'

import { LoginPage } from '@main12/auth-login/client'
import Logo from '../../../../components/Logo'

export default function DevLoginPage() {
  const handlePasswordLogin = async ({ email, password }: { email: string; password: string }) => {
    const res = await fetch('/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.errors?.[0]?.message || 'Login failed')
    }
  }

  return (
    <LoginPage
      onPasswordLogin={handlePasswordLogin}
      redirectTo="/admin"
      signupUrl="/signup"
      logo={<Logo />}
      backgroundClass="bg-white md:bg-blue-500" 
    />
  )
}