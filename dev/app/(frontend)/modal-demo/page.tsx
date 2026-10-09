'use client'

import { useState } from 'react'
import { useAuth } from '@main12/auth-login/client'

export default function ModalDemo() {
  const { user, status, openLogin, isLoggedIn, logout } = useAuth()
  const [message, setMessage] = useState('Your page stays here while you sign in.')
  const checkSession = async () => {
    try {
      if (await isLoggedIn()) setMessage('Your session is valid. You can continue.')
      else setMessage('Please sign in, then try the action again.')
    } catch {
      setMessage('Could not check your session. Please try again.')
    }
  }
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-20">
      <p className="text-sm text-gray-500">Auth provider demo</p>
      <h1 className="text-4xl font-semibold">Sign in without leaving your page</h1>
      <p>{message}</p>
      <p>
        Session: {status}
        {user?.email ? ' — ' + user.email : ''}
      </p>
      <label className="block">
        Unsaved page content
        <input
          className="mt-2 block w-full rounded-lg border p-3"
          placeholder="Type here, then open login"
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <button className="rounded-full bg-black px-5 py-3 text-white" onClick={() => openLogin()}>
          Open login
        </button>
        <button className="rounded-full border px-5 py-3" onClick={checkSession}>
          Check session and continue
        </button>
        {user && (
          <button
            className="rounded-full border px-5 py-3"
            onClick={() => {
              void logout().catch(() => setMessage('Logout failed. Please try again.'))
            }}
          >
            Log out
          </button>
        )}
      </div>
    </main>
  )
}
