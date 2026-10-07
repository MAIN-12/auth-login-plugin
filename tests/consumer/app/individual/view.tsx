'use client'
import { LoginPage, createAuthService, useAuthConfig } from '@main12/auth-login/client'
import { useEffect, useState } from 'react'
export function IndividualLogin() {
  const config = useAuthConfig()
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { setHydrated(true) }, [])
  return <main data-consumer-hydrated={hydrated ? 'true' : 'false'}><LoginPage onPasswordLogin={createAuthService(config).login} redirectTo="/landing?source=individual#complete" texture="none" /></main>
}
