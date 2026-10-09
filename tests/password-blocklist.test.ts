import { readFile } from 'node:fs/promises'
import { expect, it } from 'vitest'
import corpus from '../src/auth/domain/password-blocklist.json' with { type: 'json' }
import eligible from '../src/auth/domain/password-blocklist-eligible.json' with { type: 'json' }
import {
  evaluatePasswordStrength,
  isPasswordValid,
  MIN_PASSWORD_LENGTH,
} from '../src/auth/domain/passwordRules'

it('keeps the generated runtime subset synchronized with the licensed corpus and minimum length', () => {
  // ASCII case variants preserve length; fail visibly if future corpus updates need
  // Unicode case-mapping analysis rather than silently pruning different semantics.
  expect(corpus.every((entry) => !/[^\x00-\x7f]/.test(entry))).toBe(true)
  const expected = [...new Set(corpus.map((entry) => entry.toLowerCase()))]
    .filter((entry) => Array.from(entry).length >= MIN_PASSWORD_LENGTH)
    .sort()
  expect(eligible).toEqual(expected)
  expect(JSON.stringify(eligible).length).toBeLessThan(10000)
})

it('preserves full-corpus policy for every entry and uppercase variant through both synchronous APIs', () => {
  const blocked = new Set(corpus.map((entry) => entry.toLowerCase()))
  const fullPolicy = (password: string) =>
    Array.from(password).length >= MIN_PASSWORD_LENGTH &&
    password.length <= 1024 &&
    !blocked.has(password.toLowerCase())
  let mismatches = 0
  for (const entry of corpus) {
    for (const password of [entry, entry.toUpperCase()]) {
      const expected = fullPolicy(password)
      if (
        isPasswordValid(password) !== expected ||
        evaluatePasswordStrength(password).isValid !== expected
      )
        mismatches++
    }
  }
  expect(mismatches).toBe(0)
  for (const password of [
    'm'.repeat(MIN_PASSWORD_LENGTH - 1),
    'm'.repeat(MIN_PASSWORD_LENGTH),
    '🌊'.repeat(MIN_PASSWORD_LENGTH - 1),
    '🌊'.repeat(MIN_PASSWORD_LENGTH),
    '  The River Carries Quiet Dreams  ',
    'm'.repeat(1024),
    'm'.repeat(1025),
  ]) {
    expect(isPasswordValid(password)).toBe(fullPolicy(password))
    expect(evaluatePasswordStrength(password).isValid).toBe(fullPolicy(password))
  }
})

it('keeps the full provenance corpus out of the runtime password-rules import graph', async () => {
  const source = await readFile(
    new URL('../src/auth/domain/passwordRules.ts', import.meta.url),
    'utf8',
  )
  expect(source).toContain("from './password-blocklist-eligible.json'")
  expect(source).not.toContain("from './password-blocklist.json'")
})
