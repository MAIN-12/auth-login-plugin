import { expect, it, vi } from 'vitest'
import { createPasswordLogin } from '../src/auth/application/use-cases/passwordLogin'

it('authenticates a legacy short password exactly once and returns only a principal', async () => {
  const authenticate = vi.fn(async () => ({ accountID: 7, collection: 'customers', sid: 'sid' }))
  const login = createPasswordLogin({ enabled: true, authenticate })
  expect(await login({ email: ' OWNER@example.com ', password: 'x' })).toEqual({
    ok: true,
    value: { principal: { accountID: 7, collection: 'customers', sid: 'sid' } },
  })
  expect(authenticate).toHaveBeenCalledExactlyOnceWith({
    email: 'owner@example.com',
    password: 'x',
  })
})

it('denies disabled login before effects and captures configuration', async () => {
  const authenticate = vi.fn()
  const dependencies = { enabled: false, authenticate }
  const login = createPasswordLogin(dependencies)
  dependencies.enabled = true
  expect(await login(null as never)).toEqual({ ok: false, code: 'METHOD_DISABLED' })
  expect(authenticate).not.toHaveBeenCalled()
})
it.each([
  null,
  [],
  { email: 'bad', password: 'x' },
  { email: 'a@b.test', password: '' },
  { email: 'a@b.test', password: 'x', principal: 'forged' },
  { email: 'a@b.test', password: 'x'.repeat(1025) },
])('rejects invalid credentials without effects: %j', async (input) => {
  const authenticate = vi.fn()
  expect(await createPasswordLogin({ enabled: true, authenticate })(input as never)).toEqual({
    ok: false,
    code: 'INVALID_INPUT',
  })
  expect(authenticate).not.toHaveBeenCalled()
})
it('closes unexpected failures without exposing secrets', async () => {
  const login = createPasswordLogin({
    enabled: true,
    authenticate: async () => {
      throw new Error('private token')
    },
  })
  expect(await login({ email: 'a@b.test', password: 'x' })).toEqual({
    ok: false,
    code: 'AUTH_UNAVAILABLE',
  })
})
