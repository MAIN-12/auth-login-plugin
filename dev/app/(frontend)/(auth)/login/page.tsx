'use client'

import { useState } from 'react'
import { LoginPage } from '../../../src/components/pages/LoginPage.js'

/** Simple inline logo for dev testing */
const DevLogo = () => (
  <div className="text-2xl font-bold text-gray-900">🔐 Auth Test</div>
)

export default function DevLoginPage() {
  // Simulate Payload's login — in real project this comes from useAuth()
  const handlePasswordLogin = async ({ email, password }: { email: string; password: string }) => {
    // Call the real Payload login endpoint
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
      logo={<DevLogo />}
      onPasswordLogin={handlePasswordLogin}
      redirectTo="/admin"
      signupUrl="/signup"
      poweredBy={{ enabled: true }}
    />
  )
}