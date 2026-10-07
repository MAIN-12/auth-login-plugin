'use client'
import { useEffect, useState } from 'react'
import { SetPasswordForm } from '@main12/auth-login/client'

export function ChangeView() {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { setHydrated(true) }, [])
  return <main data-consumer-hydrated={hydrated ? 'true' : 'false'}><SetPasswordForm redirectTo="/" /></main>
}
