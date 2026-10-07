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
