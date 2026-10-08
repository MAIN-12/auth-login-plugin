import { loginOperation, type PayloadRequest } from 'payload'
import type { PublicAuthConfig } from '../../config'
import { createPasswordLogin } from '../application/use-cases/passwordLogin'
import { createNativePasswordAuth } from '../infrastructure/payload/nativePasswordAuth'
import { passwordLoginEndpoint } from '../interface/http/passwordLogin'

export function createPasswordLoginScope(
  settings: Pick<PublicAuthConfig, 'collection' | 'passwordLogin'>,
  req: PayloadRequest,
  nativeLogin: typeof loginOperation = loginOperation,
) {
  const adapter = createNativePasswordAuth(req, settings.collection, nativeLogin)
  return {
    login: createPasswordLogin({ enabled: settings.passwordLogin, ...adapter.port }),
    takeReceipt: adapter.takeReceipt,
    dispose: adapter.dispose,
  }
}
export function createPasswordLoginEndpoint(settings: PublicAuthConfig, path?: string) {
  const config = Object.freeze({ ...settings })
  return passwordLoginEndpoint(config, (req) => createPasswordLoginScope(config, req), path)
}
