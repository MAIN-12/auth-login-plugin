import { createLocalReq, type PayloadRequest } from 'payload'
import { afterEach, expect, it } from 'vitest'
import {
  beginCredentialIntent,
  clearCredentialIntent,
  guardCredentialIntent,
  observeCredentialWrite,
  assertCredentialIntent,
} from '../src/auth/server/credentialIntent'
import { credentialRequests, isCredentialRequest } from '../src/auth/server/credentialRequest'

const active: PayloadRequest[] = []
function fixture() {
  const req = new Request('http://localhost/api/auth/signup') as PayloadRequest
  Object.assign(req, {
    context: {},
    transactionID: 'native-transaction',
    payload: { config: { admin: { user: 'users' } } },
    i18n: { t: () => '' },
    payloadDataLoader: {},
    user: null,
  })
  const proxy = new Proxy(req, {
    get(target, key) {
      const value = Reflect.get(target, key, target)
      return typeof value === 'function' && key !== 'constructor' ? value.bind(target) : value
    },
    set: (target, key, value) => Reflect.set(target, key, value, target),
  })
  active.push(req)
  return { req, proxy }
}
const record = {
  id: 1,
  email: 'owner@example.test',
  _verified: true,
  hash: 'native-hash',
  salt: 'native-salt',
}
const arm = (req: PayloadRequest) => {
  credentialRequests.add(req)
  beginCredentialIntent(req, record.email, 'owner password')
}
const guard = (req: PayloadRequest, data: Record<string, unknown>) =>
  guardCredentialIntent({ req, data } as Parameters<typeof guardCredentialIntent>[0])
afterEach(() => {
  for (const req of active.splice(0)) {
    clearCredentialIntent(req)
    credentialRequests.delete(req)
  }
})

it('retains private native intent through an operation proxy and real Payload Local API normalization', async () => {
  const { req, proxy } = fixture()
  arm(req)
  const local = await createLocalReq({ req: proxy }, req.payload)
  expect(local).toBe(proxy)
  expect(local).not.toBe(req)
  expect(local.headers).toBe(req.headers)
  expect(isCredentialRequest(local)).toBe(true)
  expect(() => guard(local, { email: record.email, password: 'substituted' })).toThrow(
    'AUTH_FAILED',
  )
  expect(guard(local, { email: record.email, password: 'owner password' })).toEqual({
    email: record.email,
    password: 'owner password',
  })
  observeCredentialWrite(local, record)
  expect(() => assertCredentialIntent(req, record, 1)).not.toThrow()
})

it('does not grant intent to context, copied headers, or an unmarked request with the same transaction', () => {
  const { req } = fixture()
  arm(req)
  const hostile = {
    payload: req.payload,
    headers: req.headers,
    context: req.context,
    transactionID: req.transactionID,
  } as PayloadRequest
  expect(isCredentialRequest(hostile)).toBe(false)
  observeCredentialWrite(hostile, record)
  expect(() => assertCredentialIntent(req, record, 1)).toThrow('AUTH_FAILED')
})

it('binds a proxy capability to its exact payload, headers and native transaction', () => {
  const { req } = fixture()
  arm(req)
  for (const [key, replacement] of [
    ['payload', {}],
    ['headers', new Headers(req.headers)],
    ['transactionID', 'other-transaction'],
  ] as const) {
    const hostile = new Proxy(req, {
      get: (target, field) => (field === key ? replacement : Reflect.get(target, field, target)),
    })
    expect(isCredentialRequest(hostile)).toBe(false)
    observeCredentialWrite(hostile, record)
  }
  expect(() => assertCredentialIntent(req, record, 1)).toThrow('AUTH_FAILED')
})

it('cannot transfer native evidence between simultaneous credential intents', () => {
  const one = fixture()
  const two = fixture()
  arm(one.req)
  arm(two.req)
  observeCredentialWrite(one.proxy, record)
  expect(() => assertCredentialIntent(one.req, record, 1)).not.toThrow()
  expect(() => assertCredentialIntent(two.req, record, 1)).toThrow('AUTH_FAILED')
})

it('still rejects replacement credentials, principal substitution and replay after cleanup', () => {
  const { req, proxy } = fixture()
  arm(req)
  observeCredentialWrite(proxy, record)
  for (const changed of [
    { hash: 'replacement' },
    { salt: 'replacement' },
    { email: 'other@example.test' },
    { _verified: false },
    { deletedAt: 'now' },
    { id: 2 },
  ]) {
    expect(() => assertCredentialIntent(req, { ...record, ...changed }, 1)).toThrow('AUTH_FAILED')
  }
  clearCredentialIntent(req)
  expect(isCredentialRequest(proxy)).toBe(false)
  observeCredentialWrite(proxy, record)
  expect(() => assertCredentialIntent(proxy, record, 1)).toThrow('AUTH_FAILED')
})

it('does not bridge untransactional provisioning or re-arm an already active intent', () => {
  const { req, proxy } = fixture()
  delete req.transactionID
  arm(req)
  expect(() => beginCredentialIntent(req, record.email, 'different password')).toThrow(
    'AUTH_FAILED',
  )
  expect(isCredentialRequest(proxy)).toBe(false)
  observeCredentialWrite(proxy, record)
  expect(() => assertCredentialIntent(req, record, 1)).toThrow('AUTH_FAILED')
  observeCredentialWrite(req, record)
  expect(() => assertCredentialIntent(req, record, 1)).not.toThrow()
})

it('revokes its token even when host hooks mutate bindings before cleanup', () => {
  const { req, proxy } = fixture()
  arm(req)
  observeCredentialWrite(proxy, record)
  req.transactionID = 'changed-by-hook'
  clearCredentialIntent(req)
  req.transactionID = 'native-transaction'
  expect(isCredentialRequest(proxy)).toBe(false)
  expect(() => assertCredentialIntent(proxy, record, 1)).toThrow('AUTH_FAILED')
})
