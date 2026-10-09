import { authPlugin } from '../../../plugins'
import { AuthPages } from '@main12/auth-login/rsc'

export default function CenteredLoginDemoPage() {
  return (
    <AuthPages
      publicConfig={authPlugin.publicConfig}
      mobileVariant="card"
      slug={['login']}
      texture="spotlight-dots"
      backgroundClass="bg-zinc-900"
    />
  )
}
