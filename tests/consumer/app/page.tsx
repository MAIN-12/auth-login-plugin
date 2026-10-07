import { AuthProvider } from '@main12/auth-login/rsc'
import { plugin } from './auth-config'
import { Demo } from './demo'
export default function Page() {
  return (
    <AuthProvider publicConfig={plugin.publicConfig} initialUser={null} locale="en">
      <Demo />
    </AuthProvider>
  )
}
