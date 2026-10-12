import { expect, it } from 'vitest'
import {
  authorizeGooglePrincipal,
  authorizeGoogleLink,
  authorizeGoogleReauthentication,
} from '../src/authentication/domain/googleAccountPolicy'
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

import { authorizeGoogleAccount } from '../src/authentication/domain/googleAccountPolicy'
import type { GoogleIdentity } from '../src/authentication/domain/google'
const localAccount = { id: 1, verified: true, deleted: false }
const authoritative: GoogleIdentity[] = [
  { sub: 'google', email: 'owner@gmail.com', emailVerified: true },
  {
    sub: 'workspace',
    email: 'owner@company.com',
    emailVerified: true,
    hostedDomain: 'company.com',
  },
]
it('authoritative Google identity associates an existing account even when signup is closed', () => {
  for (const identity of authoritative)
    expect(
      authorizeGoogleAccount({
        purpose: 'login',
        signup: false,
        linked: null,
        emailAccount: localAccount,
        identity,
      }),
    ).toBe('associate')
})
it('email coincidence requires authority and never bypasses deleted or unverified account policy', () => {
  for (const identity of [
    { ...authoritative[0], emailVerified: false },
    { ...authoritative[0], email: 'owner@notgmail.com' },
    { ...authoritative[0], email: 'owner@gmail.com.evil.test' },
    { ...authoritative[0], email: 'invalid@@gmail.com' },
    { ...authoritative[1], hostedDomain: '' },
    { ...authoritative[1], hostedDomain: ' company.com ' },
    { ...authoritative[1], hostedDomain: 'https://company.com' },
    { ...authoritative[1], emailVerified: false },
  ])
    expect(() =>
      authorizeGoogleAccount({
        purpose: 'login',
        signup: true,
        linked: null,
        emailAccount: localAccount,
        identity,
      }),
    ).toThrow('AUTH_FAILED')
  for (const emailAccount of [
    { ...localAccount, deleted: true },
    { ...localAccount, verified: false },
  ])
    expect(() =>
      authorizeGoogleAccount({
        purpose: 'login',
        signup: true,
        linked: null,
        emailAccount,
        identity: authoritative[0],
      }),
    ).toThrow('AUTH_FAILED')
})
it('stable linked identity survives provider email changes but not local deletion or verification loss', () => {
  expect(
    authorizeGoogleAccount({
      purpose: 'login',
      signup: false,
      linked: localAccount,
      emailAccount: null,
      identity: { sub: 'google', emailVerified: false },
    }),
  ).toBe('existing')
  for (const linked of [
    { ...localAccount, deleted: true },
    { ...localAccount, verified: false },
  ])
    expect(() =>
      authorizeGoogleAccount({
        purpose: 'login',
        signup: true,
        linked,
        emailAccount: null,
        identity: authoritative[0],
      }),
    ).toThrow('AUTH_FAILED')
})
it('verified provider proof gives actionable account policy denials', () => {
  const input = {
    purpose: 'login' as const,
    signup: true,
    linked: null,
    emailAccount: localAccount,
    identity: { sub: 'external', email: 'owner@example.com', emailVerified: true },
  }
  expect(() => authorizeGoogleAccount(input)).toThrow(
    expect.objectContaining({ code: 'AUTH_FAILED', reason: 'GOOGLE_LINK_REQUIRED' }),
  )
  expect(() =>
    authorizeGoogleAccount({
      ...input,
      identity: authoritative[1],
      emailAccount: { ...localAccount, verified: false },
    }),
  ).toThrow(expect.objectContaining({ reason: 'ACCOUNT_NOT_VERIFIED' }))
  expect(() =>
    authorizeGoogleAccount({
      ...input,
      identity: authoritative[1],
      emailAccount: null,
      signup: false,
    }),
  ).toThrow(expect.objectContaining({ reason: 'SIGNUP_DISABLED' }))
})
