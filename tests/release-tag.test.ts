import { spawnSync } from 'node:child_process'
import { expect, it } from 'vitest'
import { validateReleaseTag } from '../scripts/validate-release-tag.mjs'

const manifest = { name: '@main12/auth-login', version: '3.0.0' }

it('accepts the exact stable package version', () => {
  expect(() => validateReleaseTag('v3.0.0', manifest)).not.toThrow()
  expect(() => validateReleaseTag('v0.0.0', { ...manifest, version: '0.0.0' })).not.toThrow()
})

it.each([
  undefined,
  '',
  '3.0.0',
  'v3.0',
  'v3.0.0-beta.1',
  'v3.0.0+build.1',
  'v03.0.0',
  'v3.00.0',
  'v3.0.00',
  'v3.0.0\n',
  'v3.0.0; echo unsafe',
])('rejects non-stable or malformed tag %s', (tag) => {
  expect(() => validateReleaseTag(tag, manifest)).toThrow('stable vX.Y.Z')
})

it('rejects tags that do not exactly match the manifest version', () => {
  expect(() => validateReleaseTag('v3.0.1', manifest)).toThrow('match package.json version')
  expect(() => validateReleaseTag('v3.0.0', { ...manifest, version: '3.0.0-beta.1' })).toThrow(
    'match package.json version',
  )
})

it('rejects an unexpected package name', () => {
  expect(() => validateReleaseTag('v3.0.0', { ...manifest, name: 'other-package' })).toThrow(
    'Release package must be @main12/auth-login',
  )
})

it('fails closed when executed without a release tag', () => {
  const env = { ...process.env }
  delete env.RELEASE_TAG
  const result = spawnSync(process.execPath, ['scripts/validate-release-tag.mjs'], {
    encoding: 'utf8',
    env,
  })
  expect(result.status).toBe(1)
  expect(result.stderr).toContain('stable vX.Y.Z')
})
