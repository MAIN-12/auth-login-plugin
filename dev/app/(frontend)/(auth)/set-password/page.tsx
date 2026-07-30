'use client'

import SetPasswordPage from '../../../../src/components/pages/SetPasswordPage.js'

const DevLogo = () => (
  <div className="text-2xl font-bold text-gray-900">🔐 Auth Test</div>
)

export default function DevSetPasswordPage() {
  return (
    <SetPasswordPage
      logo={<DevLogo />}
      redirectTo="/admin"
      poweredBy={{ enabled: true }}
    />
  )
}