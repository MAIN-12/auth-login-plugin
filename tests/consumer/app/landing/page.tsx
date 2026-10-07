import { AuthProvider } from '@main12/auth-login/rsc'
import { plugin } from '../auth-config'
import { Demo } from '../demo'
export default function Landing() { return <AuthProvider publicConfig={plugin.publicConfig}><Demo /></AuthProvider> }
