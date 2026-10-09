'use client'
import { AuthCard, AuthPages, useAuth } from '@main12/auth-login/client'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export function IntegrationView({
  surface,
  form,
  basePath,
}: {
  surface: string
  form: string
  basePath: string
}) {
  const auth = useAuth()
  const params = useSearchParams()
  const destination = params.get('redirect') ?? '/landing?source=consumer#complete'
  const identity = `${surface}/${basePath}/${form}`
  const [hydratedForm, setHydratedForm] = useState('')
  useEffect(() => {
    setHydratedForm(identity)
  }, [identity])
  // Consumer instrumentation only: no authentication/storage outcome is changed.
  return (
    <main data-consumer-hydrated={hydratedForm === identity ? 'true' : 'false'}>
      <h1>Consumer integration</h1>
      <p data-testid="email">{auth.user?.email ?? 'anonymous'}</p>
      {surface === 'modal' ? (
        <button onClick={() => auth.openLogin({ redirectTo: destination })}>Open login</button>
      ) : surface === 'page' ? (
        <AuthPages slug={[form]} basePath={basePath} redirectTo={destination} texture="none" />
      ) : (
        <AuthCard slug={form} basePath={basePath} redirectTo={destination} />
      )}
    </main>
  )
}
