'use client'
import { useAuth } from '@main12/auth-login/client'
export function Demo() {
  const auth = useAuth()
  return (
    <main>
      <h1>Packaged consumer</h1>
      <p data-testid="status">{auth.status}</p>
      <p data-testid="email">{auth.user?.email ?? 'anonymous'}</p>
      <button onClick={() => auth.openLogin()}>Open login</button>
      <button onClick={() => void auth.logout()}>Logout</button>
    </main>
  )
}
