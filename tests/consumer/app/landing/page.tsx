import { AuthProvider } from '@main12/auth-login/rsc'
import { plugin } from '../auth-config'
import { SessionProbe } from '../session-probe'
export default function Landing() {
  return (
    <AuthProvider publicConfig={plugin.publicConfig}>
      <SessionProbe />
    </AuthProvider>
  )
}
