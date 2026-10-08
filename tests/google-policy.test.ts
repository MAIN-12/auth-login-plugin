import { expect, it } from 'vitest'
import {
  authorizeGooglePrincipal,
  authorizeGoogleLink,
  authorizeGoogleReauthentication,
} from '../src/auth/domain/googleAccountPolicy'
const principal = { id: 1, sid: 'sid', version: 'opaque', email: 'owner@example.com' }
it('reauth rejects nonfinite or stale provider authentication evidence even for the exact association', () => {
  for (const authenticatedAt of [NaN, Infinity, -Infinity, -300001, 31001]) {
    expect(() =>
      authorizeGoogleReauthentication(
        principal,
        1,
        { sub: 'stable', emailVerified: true, authenticatedAt },
        1000,
      ),
    ).toThrow('AUTH_FAILED')
  }
})
it('selected principal changes and duplicate subject ownership cannot grant a link', () => {
  const current = { ...principal, verified: true, deleted: false, sessionActive: true }
  expect(() =>
    authorizeGooglePrincipal({ principal, current: { ...current, version: 'changed' } }),
  ).toThrow('AUTH_FAILED')
  expect(() =>
    authorizeGooglePrincipal({ principal, current: { ...current, sid: 'other' } }),
  ).toThrow('AUTH_FAILED')
  expect(() =>
    authorizeGooglePrincipal({ principal, current: { ...current, sessionActive: false } }),
  ).toThrow('AUTH_FAILED')
  expect(() =>
    authorizeGoogleLink(
      principal,
      {
        purpose: 'reauth',
        account: 1,
        email: principal.email,
        sid: 'sid',
        version: 'opaque',
        nonce: 'n',
      },
      2,
    ),
  ).toThrow('AUTH_FAILED')
})
