import { expect, it } from 'vitest'
import { authLoginPlugin } from '../src/index'
it.each(['allowSignup', 'recovery'] as const)('requires ownership-proof configuration before enabling %s', flag => {
  expect(() => authLoginPlugin({ passwordLogin: true, otpLogin: false, providers: { google: false }, allowSignup: false, recovery: false, [flag]: true })).toThrow('OTP requires')
})
it('fails closed for Google rather than loading the unsafe legacy provider', () => {
  expect(() => authLoginPlugin({ passwordLogin: true, otpLogin: false, providers: { google: { enabled: true, clientId: 'test-id', clientSecret: 'secret' } }, allowSignup: false, recovery: false })).toThrow('unavailable')
})

it('requires a dedicated key and trusted server-origin resolver before enabling OTP', () => {
  expect(() => authLoginPlugin({ passwordLogin: true, otpLogin: true, providers: { google: false }, allowSignup: false, recovery: false })).toThrow('OTP requires')
})
