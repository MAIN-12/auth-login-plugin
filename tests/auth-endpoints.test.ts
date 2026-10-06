import { expect, it } from 'vitest'
import { authLoginPlugin } from '../src/index'
it.each(['otpLogin', 'allowSignup', 'recovery'] as const)('fails closed at startup for pending %s', flag => {
  expect(() => authLoginPlugin({ passwordLogin: true, otpLogin: false, providers: { google: false }, allowSignup: false, recovery: false, [flag]: true })).toThrow('unavailable')
})
it('fails closed for Google rather than loading the unsafe legacy provider', () => {
  expect(() => authLoginPlugin({ passwordLogin: true, otpLogin: false, providers: { google: { enabled: true, clientId: 'test-id', clientSecret: 'secret' } }, allowSignup: false, recovery: false })).toThrow('unavailable')
})
