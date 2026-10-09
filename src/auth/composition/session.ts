import { refreshOperation, type PayloadRequest } from 'payload'
import type { PublicAuthConfig } from '../../config'
import { createOwnCapabilities, createSessionRefresh } from '../application/use-cases/session'
import { createOwnCapabilitiesRepository } from '../infrastructure/payload/credentialEvidence'
import { capabilitiesEndpoint, refreshEndpoint, type RefreshScope } from '../interface/http/session'

export function createCapabilitiesScope(collection: string, req: PayloadRequest) {
  const repository = createOwnCapabilitiesRepository(req, collection)
  return { capabilities: createOwnCapabilities(repository.port), dispose: repository.dispose }
}
export function createCapabilitiesEndpoint(settings: PublicAuthConfig) {
  const config = Object.freeze({ ...settings })
  return capabilitiesEndpoint(config, (req) => createCapabilitiesScope(config.collection, req))
}

import { createNativeRefresh } from '../infrastructure/payload/nativeRefresh'
export function createRefreshScope(
  collection: string,
  req: PayloadRequest,
  native: typeof refreshOperation = refreshOperation,
): RefreshScope {
  const adapter = createNativeRefresh(req, collection, native)
  return {
    refresh: createSessionRefresh(adapter.port),
    takeReceipt: adapter.takeReceipt,
    dispose: adapter.dispose,
  }
}
export function createRefreshEndpoint(settings: PublicAuthConfig) {
  const config = Object.freeze({ ...settings })
  return refreshEndpoint(config, (req) => createRefreshScope(config.collection, req))
}
