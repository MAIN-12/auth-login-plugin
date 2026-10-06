import { Suspense } from 'react'
import { AuthProvider } from '@main12/auth-login/rsc'
import { SetPasswordForm } from '@main12/auth-login/client'
import { plugin } from '../auth-config'

// Public standalone composition, exercising the same packed form as consumers.
export default function ChangePage() {
  return <AuthProvider publicConfig={plugin.publicConfig} locale="en"><Suspense><SetPasswordForm redirectTo="/" /></Suspense></AuthProvider>
}
