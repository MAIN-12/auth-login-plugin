import { Suspense } from 'react'
import { AuthProvider } from '@main12/auth-login/rsc'
import { plugin } from '../auth-config'
import { IndividualLogin } from './view'
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ style?: string }>
}) {
  const style = (await searchParams).style === 'hero-ui' ? 'hero-ui' : 'tailwind'
  return (
    <AuthProvider
      publicConfig={plugin.publicConfig}
      locale="en"
      style={style}
      initialUser={null}
      poweredBy={{ enabled: false }}
    >
      <Suspense>
        <IndividualLogin />
      </Suspense>
    </AuthProvider>
  )
}
