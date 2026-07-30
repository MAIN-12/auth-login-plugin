'use client'

import SignupPage from '../../../../src/components/pages/SignupPage.js'

const DevLogo = () => (
  <div className="text-2xl font-bold text-gray-900">🔐 Auth Test</div>
)

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
      logo={<DevLogo />}
      onSignup={handleSignup}
      loginUrl="/login"
      poweredBy={{ enabled: true }}
    />
  )
}