'use client'

import { SignupPage } from '@main12/auth-login/client'
import Logo from '../../../../components/Logo'

export default function DevSignupPage() {
  const handleSignup = async ({ name, email }: { name: string; email: string }) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.message || 'Signup failed')
    }
  }

  return (
    <SignupPage
      onSignup={handleSignup}
      loginUrl="/login"
      logo={<Logo />}
    />
  )
}