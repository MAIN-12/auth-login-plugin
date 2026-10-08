import { expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { createPasswordLoginScope } from '../src/auth/composition/passwordLogin'
import { resolveAuthConfig } from '../src/config'
const settings = resolveAuthConfig({
  passwordLogin: true,
  otpLogin: false,
  providers: { google: false },
  allowSignup: false,
  recovery: false,
})
const req = { payload: { collections: { users: {} } } } as unknown as PayloadRequest
it('keeps native receipt private and passes the exact request once', async () => {
  const nativeLogin = vi.fn(async () => ({
    user: { id: 4, collection: 'users', _sid: 'sid', _verified: true },
    token: 'private-token',
    exp: 123,
  }))
  const scope = createPasswordLoginScope(settings, req, nativeLogin as never)
  const result = await scope.login({ email: 'A@b.test', password: 'x' })
  expect(result).toEqual({
    ok: true,
    value: { principal: { accountID: 4, collection: 'users', sid: 'sid' } },
  })
  expect(nativeLogin).toHaveBeenCalledExactlyOnceWith({
    collection: req.payload.collections.users,
    req,
    data: { email: 'a@b.test', password: 'x' },
  })
  expect(scope.takeReceipt()).toMatchObject({ token: 'private-token', exp: 123 })
  expect(() => scope.takeReceipt()).toThrow('AUTH_UNAVAILABLE')
})

import { AuthenticationError } from 'payload'
it('maps native authentication rejection to a semantic failure and clears its receipt', async () => {
  const nativeLogin = vi.fn(async () => {
    throw new AuthenticationError((key: string) => key as never)
  })
  const scope = createPasswordLoginScope(settings, req, nativeLogin as never)
  expect(await scope.login({ email: 'a@b.test', password: 'wrong' })).toEqual({
    ok: false,
    code: 'AUTH_FAILED',
  })
  expect(() => scope.takeReceipt()).toThrow('AUTH_UNAVAILABLE')
  scope.dispose()
  expect(nativeLogin).toHaveBeenCalledTimes(1)
})
it.each([
  {},
  { user: { id: 4 }, token: 'secret' },
  { user: { id: 4 }, token: 3, exp: 10 },
  { user: {}, token: 'secret', exp: 10 },
])('closes malformed native receipts: %j', async (receipt) => {
  const scope = createPasswordLoginScope(settings, req, vi.fn(async () => receipt) as never)
  expect(await scope.login({ email: 'a@b.test', password: 'x' })).toEqual({
    ok: false,
    code: 'AUTH_UNAVAILABLE',
  })
  expect(() => scope.takeReceipt()).toThrow('AUTH_UNAVAILABLE')
})
it('denies disabled configuration without native lookup, even if the caller changes it', async () => {
  const config = { ...settings, passwordLogin: false }
  const missing = {} as PayloadRequest
  const nativeLogin = vi.fn()
  const scope = createPasswordLoginScope(config, missing, nativeLogin)
  config.passwordLogin = true
  expect(await scope.login({ email: 'a@b.test', password: 'x' })).toEqual({
    ok: false,
    code: 'METHOD_DISABLED',
  })
  expect(nativeLogin).not.toHaveBeenCalled()
})
it('isolates interleaved requests and instances and clears receipt on disposal without native retries', async () => {
  const other = { payload: { collections: { members: {} } } } as unknown as PayloadRequest
  const nativeLogin = vi.fn(async ({ req: request }: { req: PayloadRequest }) => ({
    user: { id: request === req ? 1 : 2 },
    token: request === req ? 'first-secret' : 'second-secret',
    exp: 123,
  }))
  const first = createPasswordLoginScope(settings, req, nativeLogin as never)
  const second = createPasswordLoginScope(
    { ...settings, collection: 'members' },
    other,
    nativeLogin as never,
  )
  const results = await Promise.all([
    first.login({ email: 'a@b.test', password: 'x' }),
    second.login({ email: 'a@b.test', password: 'y' }),
  ])
  expect(results).toEqual([
    { ok: true, value: { principal: { accountID: 1, collection: 'users' } } },
    { ok: true, value: { principal: { accountID: 2, collection: 'members' } } },
  ])
  expect(second.takeReceipt().token).toBe('second-secret')
  first.dispose()
  expect(() => first.takeReceipt()).toThrow('AUTH_UNAVAILABLE')
  expect(await first.login({ email: 'a@b.test', password: 'x' })).toEqual({
    ok: false,
    code: 'AUTH_UNAVAILABLE',
  })
  expect(nativeLogin).toHaveBeenCalledTimes(2)
})
