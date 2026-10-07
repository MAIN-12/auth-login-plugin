import { Suspense } from 'react'
import { AuthProvider } from '@main12/auth-login/rsc'
import { ChangeView } from './view'
import { plugin } from '../auth-config'

// Public standalone composition, exercising the same packed form as consumers.
export default function ChangePage() {
  return <AuthProvider publicConfig={plugin.publicConfig} locale="en"><Suspense><ChangeView /></Suspense></AuthProvider>
}
