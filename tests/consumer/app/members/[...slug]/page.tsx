import { Suspense } from 'react'
import { AuthProvider } from '@main12/auth-login/rsc'
import { plugin } from '../../auth-config'
import { IntegrationView } from './view'

export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params
  const matrix = ['card', 'page', 'modal'].includes(slug[0])
  const surface = matrix ? slug[0] : 'page'
  const style = matrix && slug[1] === 'hero-ui' ? 'hero-ui' : 'tailwind'
  const locale = matrix && slug[2] === 'es' ? 'es' : 'en'
  const form = matrix ? (slug[3] ?? 'login') : slug[0]
  const basePath = matrix ? `/members/${surface}/${style}/${locale}` : '/members'
  return (
    <AuthProvider
      publicConfig={plugin.publicConfig}
      style={style}
      locale={locale}
      basePath={basePath}
      initialUser={null}
      poweredBy={{ enabled: false }}
    >
      <Suspense>
        <IntegrationView surface={surface} form={form} basePath={basePath} />
      </Suspense>
    </AuthProvider>
  )
}
