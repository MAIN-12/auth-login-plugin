import { AuthLoginOtpSecurity } from './AuthLoginOtpSecurity'
import { AuthLoginCredentialLocks } from './AuthLoginCredentialLocks'
import { AuthLoginPasswordPermits } from './AuthLoginPasswordPermits'
import { AuthLoginIdentities } from './AuthLoginIdentities'
import { AuthLoginCutovers } from './AuthLoginCutovers'
import type { CollectionConfig } from 'payload'

/** Fixed names let native SQL coordinate across configured auth collections. */
export const authLoginCollections: CollectionConfig[] = [
  AuthLoginOtpSecurity,
  AuthLoginCredentialLocks,
  AuthLoginPasswordPermits,
  AuthLoginIdentities,
  AuthLoginCutovers,
]

export function assertAuthLoginCollectionNamesAvailable(collections: CollectionConfig[]): void {
  for (const internal of authLoginCollections) {
    for (const existing of collections) {
      const dbName =
        typeof existing.dbName === 'function'
          ? existing.dbName({ tableName: existing.slug.replaceAll('-', '_') })
          : (existing.dbName ?? existing.slug.replaceAll('-', '_'))
      if (existing.slug === internal.slug || dbName === internal.dbName)
        throw new Error(`auth-login: reserved collection name conflicts with ${existing.slug}`)
    }
  }
}

/** Sanitization mutates configs; each host needs independent field/index/access objects. */
export function createAuthLoginCollections(): CollectionConfig[] {
  return authLoginCollections.map((collection) => ({
    ...collection,
    admin: { ...collection.admin },
    access: { ...collection.access },
    fields: collection.fields.map((field) => ({ ...field })),
    ...(collection.indexes
      ? { indexes: collection.indexes.map((index) => ({ ...index, fields: [...index.fields] })) }
      : {}),
  }))
}
