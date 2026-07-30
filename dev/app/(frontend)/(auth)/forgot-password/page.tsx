'use client'

import ForgotPasswordPage from '../../../../src/components/pages/ForgotPasswordPage.js'

const DevLogo = () => (
  <div className="text-2xl font-bold text-gray-900">🔐 Auth Test</div>
)

export default function DevForgotPasswordPage() {
  return (
    <ForgotPasswordPage
      logo={<DevLogo />}
      loginUrl="/login"
      poweredBy={{ enabled: true }}
    />
  )
}