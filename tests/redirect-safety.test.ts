import { expect, it } from 'vitest'
import { safeAuthRedirect } from '../src/auth/domain/redirect'
it('rejects encoded authority, backslash and controls while preserving local query and hash', () => {
  for (const value of [
    '//evil.test',
    '/%2fevil.test',
    '/%2f%2fevil.test',
    '/%5cevil.test',
    '/%252f%252fevil.test',
    '/%0devil.test',
    '/%20/evil.test',
  ])
    expect(safeAuthRedirect(value)).toBe('/')
  expect(safeAuthRedirect('/dashboard?next=%2Fsafe#section')).toBe(
    '/dashboard?next=%2Fsafe#section',
  )
})
it.each([
  '/caf%C3%A9/%E6%AC%A2%E8%BF%8E',
  '/dashboard?message=hello%20world&next=%2Fsafe#caf%C3%A9',
  '/caf%C3%A9?q=%E6%AC%A2%E8%BF%8E#hello%20world',
])('preserves valid percent-encoded local destination %s', (value) => {
  expect(safeAuthRedirect(value, '/fallback')).toBe(value)
})
it.each(['/bad%', '/bad%2', '/bad%GG', '/%C3%28', '/hello%20world'])(
  'falls back for malformed encoding or decoded path whitespace: %s',
  (value) => {
    expect(safeAuthRedirect(value, '/fallback')).toBe('/fallback')
  },
)
