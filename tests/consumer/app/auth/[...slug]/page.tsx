import { Suspense } from 'react'
import { AuthProvider } from '@main12/auth-login/rsc'
import { AuthPages, SetPasswordForm, VerifyOtpForm } from '@main12/auth-login/client'
import { plugin } from '../../auth-config'

export default async function AuthPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params
  return (
    <AuthProvider publicConfig={plugin.publicConfig} locale="en">
      <Suspense>
        {slug[0] === 'verify-otp' ? (
          <VerifyOtpForm />
        ) : slug[0] === 'set-password' ? (
          <SetPasswordForm redirectTo="/" />
        ) : (
          <AuthPages slug={slug} redirectTo="/" />
        )}
      </Suspense>
    </AuthProvider>
  )
}
