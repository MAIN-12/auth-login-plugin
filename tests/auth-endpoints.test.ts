import { expect, it } from 'vitest'
import { authLoginPlugin } from '../src/index'
it.each(['allowSignup', 'recovery'] as const)(
  'requires ownership-proof configuration before enabling %s',
  (flag) => {
    expect(() =>
      authLoginPlugin({
        passwordLogin: true,
        otpLogin: false,
        providers: { google: false },
        allowSignup: false,
        recovery: false,
        [flag]: true,
      }),
    ).toThrow('OTP requires')
  },
)
it('requires a complete private Google configuration rather than the unsafe legacy provider', () => {
  expect(() =>
    authLoginPlugin({
      passwordLogin: true,
      otpLogin: false,
      providers: { google: { enabled: true, clientId: 'test-id', clientSecret: 'secret' } },
      allowSignup: false,
      recovery: false,
    }),
  ).toThrow('Google requires')
})

it('requires a dedicated key and trusted server-origin resolver before enabling OTP', () => {
  expect(() =>
    authLoginPlugin({
      passwordLogin: true,
      otpLogin: true,
      providers: { google: false },
      allowSignup: false,
      recovery: false,
    }),
  ).toThrow('OTP requires')
})

import type { PayloadRequest } from 'payload'
import { resolveAuthConfig } from '../src/config'
import { createGoogleEndpoints } from '../src/endpoints/googleEndpoints'
it('correlates callback rejection with a server-generated safe ID, never provider secrets', async () => {
  const options = {
    enabled: true,
    clientId: 'private-client',
    clientSecret: 'private-secret',
    redirectURI: 'https://app.test/backend/access/oauth/google/callback',
  }
  const settings = resolveAuthConfig({
    passwordLogin: true,
    otpLogin: false,
    providers: { google: options },
    allowSignup: false,
    recovery: false,
  })
  const events: unknown[] = []
  const req = {
    url: options.redirectURI + '?state=raw-state-secret&code=raw-code-secret',
    headers: new Headers({
      host: 'wrong.test',
      cookie: 'private-cookie',
      'X-Auth-Request-ID': 'caller-controlled',
    }),
    payload: { config: { cors: [] }, logger: { info: (event: unknown) => events.push(event) } },
  } as unknown as PayloadRequest
  const response = await createGoogleEndpoints(settings, options).at(-1)!.handler(req)
  const requestId = response.headers.get('X-Auth-Request-ID')
  expect(response.status).toBe(401)
  expect(requestId).toMatch(/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/)
  expect(events).toEqual([{ event: 'auth_login_google_callback_rejected', requestId }])
  expect(JSON.stringify(events)).not.toMatch(
    /raw-state-secret|raw-code-secret|private-cookie|private-secret|caller-controlled/,
  )
})

it('keeps a callback rejection and cookie cleanup safe when the consumer logger throws', async () => {
  const options = {
    enabled: true,
    clientId: 'private-client',
    clientSecret: 'private-secret',
    redirectURI: 'https://app.test/backend/access/oauth/google/callback',
  }
  const settings = resolveAuthConfig({
    passwordLogin: true,
    otpLogin: false,
    providers: { google: options },
    allowSignup: false,
    recovery: false,
  })
  const state = 'a'.repeat(43)
  const req = {
    url: options.redirectURI + '?state=' + state + '&code=private-code',
    headers: new Headers({ host: 'app.test' }),
    payload: {
      config: { cors: [] },
      logger: {
        info: () => {
          throw new Error('private logging failure')
        },
      },
    },
  } as unknown as PayloadRequest
  // Missing storage rejects before provider traffic, after extracting the correlation state.
  const response = await createGoogleEndpoints(settings, options).at(-1)!.handler(req)
  expect(response.status).toBe(503)
  expect(await response.json()).toEqual({ success: false, code: 'AUTH_UNAVAILABLE' })
  expect(response.headers.get('X-Auth-Request-ID')).toMatch(
    /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/,
  )
  expect(response.headers.get('Set-Cookie')).toContain('Max-Age=0')
  expect(response.headers.get('Set-Cookie')).toContain(settings.collection + '-oauth-' + state)
})
