import { expect, it, vi } from 'vitest'
const oidc = vi.hoisted(() => ({
  claims: {
    sub: 'subject',
    email: ' Owner@Company.com ',
    email_verified: true,
    hd: 'company.com',
  } as Record<string, unknown>,
  signature: vi.fn(async () => undefined),
}))
vi.mock('oauth4webapi', async (original) => ({
  ...(await original<typeof import('oauth4webapi')>()),
  discoveryRequest: vi.fn(async () => new Response()),
  processDiscoveryResponse: vi.fn(async () => ({})),
  validateAuthResponse: vi.fn(() => new URLSearchParams()),
  authorizationCodeGrantRequest: vi.fn(async () => new Response()),
  processAuthorizationCodeResponse: vi.fn(async () => ({})),
  validateApplicationLevelSignature: oidc.signature,
  getValidatedIdTokenClaims: vi.fn(() => oidc.claims),
}))
import { createGoogleProvider } from '../src/authentication/infrastructure/providers/googleProvider'
const correlation = {
  state: 'state',
  nonce: 'nonce',
  verifier: 'verifier',
  browser: 'browser',
  returnTo: '/',
  expiresAt: 1000,
  purpose: 'login' as const,
}
const provider = () =>
  createGoogleProvider({
    enabled: true,
    clientId: 'client',
    clientSecret: 'secret',
    redirectURI: 'https://app.test/callback',
  })
it('retains hosted domain only from validated signed ID token claims', async () => {
  expect(await provider().exchange('https://app.test/callback', correlation)).toMatchObject({
    email: 'owner@company.com',
    emailVerified: true,
    hostedDomain: 'company.com',
  })
  expect(oidc.signature).toHaveBeenCalled()
  oidc.claims.hd = ['company.com']
  expect(
    (await provider().exchange('https://app.test/callback?hd=company.com', correlation))
      .hostedDomain,
  ).toBeUndefined()
  oidc.claims.hd = 'company.com'
})
it('never returns authority when signature validation rejects an otherwise plausible hd claim', async () => {
  oidc.signature.mockRejectedValueOnce(new Error('invalid signature'))
  await expect(provider().exchange('https://app.test/callback', correlation)).rejects.toThrow(
    'invalid signature',
  )
})
it('verified protocol rejection exposes only a stable provider reason', async () => {
  const { OperationProcessingError } = await import('oauth4webapi')
  oidc.signature.mockRejectedValueOnce(new OperationProcessingError('private signature details'))
  await expect(provider().exchange('https://app.test/callback', correlation)).rejects.toMatchObject(
    { code: 'AUTH_FAILED', reason: 'GOOGLE_IDENTITY_REJECTED', message: 'AUTH_FAILED' },
  )
})
