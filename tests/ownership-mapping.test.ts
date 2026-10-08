import { expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { createPasswordEndpoints, createOwnershipScope } from '../src/auth/composition/ownership'
import { publicConfig } from './auth-test-config'

it('disabled recovery alias is inert even for malformed input and retains METHOD_DISABLED', async () => {
  const findOne = vi.fn()
  const sendEmail = vi.fn()
  const req = {
    headers: new Headers(),
    json: async () => ({ email: 123 }),
    payload: { db: { findOne }, sendEmail, logger: { info: () => {} }, config: { cors: [] } },
  } as unknown as PayloadRequest
  const endpoint = createPasswordEndpoints({ ...publicConfig, recovery: false }).find((endpoint) =>
    endpoint.path.endsWith('/forgot-password'),
  )!
  const response = (await endpoint.handler(req)) as Response
  expect(response.status).toBe(403)
  expect(await response.json()).toEqual({ success: false, code: 'METHOD_DISABLED' })
  expect(response.headers.get('set-cookie')).toBeNull()
  expect(findOne).not.toHaveBeenCalled()
  expect(sendEmail).not.toHaveBeenCalled()
})
it('a request scope captures method configuration and denies every attempt after disposal without native lookup', async () => {
  const findOne = vi.fn()
  const req = { headers: new Headers(), payload: { db: { findOne } } } as unknown as PayloadRequest
  const config = { ...publicConfig, allowSignup: false }
  const scope = createOwnershipScope(config, req)
  config.allowSignup = true
  await expect(
    scope.send({ purpose: 'signup', email: 'owner@example.com' }, 'peer'),
  ).rejects.toThrow('METHOD_DISABLED')
  scope.dispose()
  await expect(
    scope.verify({
      purpose: 'signup',
      email: 'owner@example.com',
      otp: '123456',
      context: 'a'.repeat(64),
    }),
  ).rejects.toThrow('AUTH_UNAVAILABLE')
  expect(findOne).not.toHaveBeenCalled()
})
