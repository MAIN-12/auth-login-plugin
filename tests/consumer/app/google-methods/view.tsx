'use client'
import { useState } from 'react'
import { createAuthService } from '@main12/auth-login/client'
import type { PublicAuthConfig } from '@main12/auth-login'

// Disposable consumer composition of public actions, not a production account-management UI.
export function GoogleMethods({ config }: { config: PublicAuthConfig }) {
  const service = createAuthService(config)
  const [permit, setPermit] = useState<Awaited<ReturnType<typeof service.reauthenticateGoogle>>>()
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('idle')
  const perform = async (action: () => Promise<void>) => { try { setStatus('working'); await action() } catch { setStatus('rejected') } }
  return <main>
    <label>Password<input aria-label="Password" type="password" value={password} onChange={event => setPassword(event.target.value)} /></label>
    <button onClick={() => void perform(async () => { setPermit(await service.reauthenticate(password)); setStatus('verified') })}>Verify password</button>
    <button onClick={() => void perform(async () => { setPermit(await service.reauthenticateGoogle()); setStatus('verified') })}>Verify Google</button>
    <button onClick={() => void perform(async () => { if (!permit) throw new Error(); await service.linkGoogle(permit.permit, '/google-methods?linked=1#confirmed') })}>Link Google explicitly</button>
    <button onClick={() => void perform(async () => { if (!permit) throw new Error(); await service.completePassword(permit, password); setStatus('password-added') })}>Add password explicitly</button>
    <p data-testid="google-method-status">{status}</p>
  </main>
}
