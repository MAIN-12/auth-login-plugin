import { expect, it, vi } from 'vitest'
import { createAuthLoginMigration } from '../src/auth/application/use-cases/migrateAuthLogin'

it('maintenance admission denies a missing attestation or invalid inventory before native effects', async () => {
  const commit = vi.fn()
  const migrate = createAuthLoginMigration({ commit })
  await expect(migrate({ collection: 'customers', maintenance: false as true })).rejects.toThrow(
    'maintenance',
  )
  await expect(
    migrate({
      collection: 'customers',
      maintenance: true,
      legacyOtpCollection: { slug: 'customers' },
    }),
  ).rejects.toThrow('inventory')
  expect(commit).not.toHaveBeenCalled()
})

it('maintenance returns only aggregate evidence from the native commit and propagates failure without retry', async () => {
  const commit = vi.fn(async () => ({
    success: true as const,
    collection: 'customers',
    accounts: 2,
    legacyCodesDeleted: 1,
    generation: 'a'.repeat(64),
    hash: 'private',
    sessions: ['private'],
  }))
  const migrate = createAuthLoginMigration({ commit })
  expect(await migrate({ collection: 'customers', maintenance: true })).toEqual({
    success: true,
    collection: 'customers',
    accounts: 2,
    legacyCodesDeleted: 1,
    generation: 'a'.repeat(64),
  })
  const failure = new Error('native cutoff failed')
  commit.mockRejectedValueOnce(failure)
  await expect(migrate({ collection: 'customers', maintenance: true })).rejects.toBe(failure)
  expect(commit).toHaveBeenCalledTimes(2)
})
