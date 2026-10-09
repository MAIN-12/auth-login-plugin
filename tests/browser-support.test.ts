import { describe, expect, it } from 'vitest'
import { messageCode, requiredHeader } from './browser-support.ts'

describe('typed browser acceptance helpers', () => {
  it('returns required HTTP headers and fails descriptively when absent', () => {
    expect(requiredHeader(new Response('', { headers: { location: '/next' } }), 'location')).toBe(
      '/next',
    )
    expect(() => requiredHeader(new Response(), 'location')).toThrow(
      'expected response header location',
    )
  })

  it('extracts a six-digit code only from an existing fixture message', () => {
    const message = { to: 'browser@example.com', html: '<b>123456</b>', subject: 'Login', date: '' }
    expect(messageCode(message)).toBe('123456')
    expect(() => messageCode(undefined)).toThrow('expected fixture email')
    expect(() => messageCode({ ...message, html: 'No code' })).toThrow(
      'expected six-digit email code',
    )
    expect(() => messageCode({ ...message, html: '1234567' })).toThrow(
      'expected six-digit email code',
    )
  })
})
