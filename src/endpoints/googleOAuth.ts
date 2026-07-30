import type { Endpoint } from 'payload'

/**
 * Google OAuth 2.0 — zero dependencies, pure REST.
 *
 * Flow:
 * 1. GET /api/auth/oauth/google → Google consent screen
 * 2. GET /api/auth/oauth/google/callback → exchange code, get profile, login, redirect
 *
 * Requires env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 */

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'

function env(key: string, fb = '') { return process.env[key] || fb }

/**
 * GET /api/auth/oauth/google — start Google OAuth flow
 */
export const googleOAuthStart: Endpoint = {
  path: '/api/auth/oauth/google',
  method: 'get',
  handler: async (req) => {
    const clientId = env('GOOGLE_CLIENT_ID')
    if (!clientId) return Response.json({ error: 'Google OAuth not configured' }, { status: 501 })

    const url = new URL(req.url || 'http://localhost')
    const redirect = url.searchParams.get('redirect') || '/'
    const base = env('NEXT_PUBLIC_SERVER_URL', 'http://localhost:3000')

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${base}/api/auth/oauth/google/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      state: encodeURIComponent(redirect),
    })

    return Response.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`, 302)
  },
}

/**
 * GET /api/auth/oauth/google/callback — handle Google's redirect back
 */
export const googleOAuthCallback: Endpoint = {
  path: '/api/auth/oauth/google/callback',
  method: 'get',
  handler: async (req) => {
    const url = new URL(req.url || 'http://localhost')
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state') || '/'
    const redirectTo = decodeURIComponent(state)

    if (!code) return Response.redirect(`/login?error=${url.searchParams.get('error') || 'oauth_failed'}`, 302)

    const clientId = env('GOOGLE_CLIENT_ID')
    const clientSecret = env('GOOGLE_CLIENT_SECRET')
    const base = env('NEXT_PUBLIC_SERVER_URL', 'http://localhost:3000')

    try {
      // 1. Exchange code for access token
      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code, client_id: clientId, client_secret: clientSecret,
          redirect_uri: `${base}/api/auth/oauth/google/callback`,
          grant_type: 'authorization_code',
        }),
      })
      if (!tokenRes.ok) return Response.redirect(`/login?error=oauth_failed`, 302)

      const tokens = await tokenRes.json() as any
      const accessToken = tokens.access_token

      // 2. Get Google profile
      const profileRes = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!profileRes.ok) return Response.redirect(`/login?error=oauth_failed`, 302)

      const profile = await profileRes.json() as any
      const email = profile.email?.toLowerCase()
      const name = profile.name || email?.split('@')[0]
      if (!email) return Response.redirect(`/login?error=oauth_failed`, 302)

      // 3. Find or create user
      const users = await req.payload.find({
        collection: 'users',
        where: { email: { equals: email } },
        limit: 1,
      })

      let userId: string
      let userPw: string

      if (users.docs?.length) {
        userId = users.docs[0].id as string
        // Set a known temp password so we can login
        userPw = `g_tmp_${Date.now()}`
        await req.payload.update({
          collection: 'users',
          id: userId,
          data: { password: userPw } as any,
        })
      } else {
        userPw = `g_new_${Date.now()}`
        const newUser = await req.payload.create({
          collection: 'users',
          data: { email, name, password: userPw, authProvider: 'google' } as any,
        })
        userId = (newUser as any).id
      }

      // 4. Login
      const loginResult = await req.payload.login({
        collection: 'users',
        data: { email, password: userPw },
        req: req as any,
      })

      // 5. Set cookie + redirect
      const response = Response.redirect(redirectTo, 302)
      if (loginResult.token) {
        response.headers.set(
          'Set-Cookie',
          `payload-token=${loginResult.token}; Path=/; HttpOnly; SameSite=Lax` +
          `${process.env.NODE_ENV === 'production' ? '; Secure' : ''}` +
          `; Max-Age=${loginResult.exp || 7200}`,
        )
      }
      return response
    } catch (err) {
      console.error('[auth-login] Google OAuth error:', err)
      return Response.redirect(`/login?error=oauth_failed`, 302)
    }
  },
}

export const googleOAuthEndpoints: Endpoint[] = [googleOAuthStart, googleOAuthCallback]