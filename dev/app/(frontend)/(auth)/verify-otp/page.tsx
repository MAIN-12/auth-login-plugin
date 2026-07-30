'use client'

import VerifyOtpPage from '../../../../src/components/pages/VerifyOtpPage.js'

const DevLogo = () => (
  <div className="text-2xl font-bold text-gray-900">🔐 Auth Test</div>
)

export default function DevVerifyOtpPage() {
  return (
    <VerifyOtpPage
      logo={<DevLogo />}
      loginUrl="/login"
      poweredBy={{ enabled: true }}
    />
  )
}