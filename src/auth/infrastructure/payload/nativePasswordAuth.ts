import {
  AuthenticationError,
  Forbidden,
  LockedAuth,
  UnverifiedEmail,
  loginOperation,
  type PayloadRequest,
} from 'payload'
import { AuthOperationFailure } from '../../domain/errors'
import { AuthFailure } from '../../contracts/errors'
import type { NativePasswordAuth } from '../../application/ports/nativePasswordAuth'

/** Native documents/tokens never cross the application port. */
export function createNativePasswordAuth(
  req: PayloadRequest,
  collectionSlug: string,
  nativeLogin: typeof loginOperation = loginOperation,
) {
  let receipt: Awaited<ReturnType<typeof loginOperation>> | undefined
  let started = false
  const port: NativePasswordAuth = {
    async authenticate(data) {
      // A scope owns one native attempt and one receipt; no retry after hooks start.
      if (started) throw new AuthOperationFailure('AUTH_UNAVAILABLE')
      started = true
      try {
        const result = await nativeLogin({
          collection: req.payload.collections[collectionSlug],
          data,
          req,
        })
        if (
          !result.user ||
          !result.token ||
          typeof result.token !== 'string' ||
          !['string', 'number'].includes(typeof result.user.id) ||
          typeof result.exp !== 'number' ||
          !Number.isFinite(result.exp)
        )
          throw new AuthOperationFailure('AUTH_UNAVAILABLE')
        receipt = result
        return {
          accountID: result.user.id,
          collection: collectionSlug,
          ...(typeof result.user._sid === 'string' ? { sid: result.user._sid } : {}),
        }
      } catch (error) {
        receipt = undefined
        if (error instanceof AuthOperationFailure) throw error
        if (error instanceof AuthFailure) throw new AuthOperationFailure(error.code)
        if (
          error instanceof AuthenticationError ||
          error instanceof LockedAuth ||
          error instanceof UnverifiedEmail ||
          error instanceof Forbidden
        )
          throw new AuthOperationFailure('AUTH_FAILED')
        throw new AuthOperationFailure('AUTH_UNAVAILABLE')
      }
    },
  }
  return {
    port,
    takeReceipt() {
      const result = receipt
      receipt = undefined
      if (!result) throw new AuthOperationFailure('AUTH_UNAVAILABLE')
      return result
    },
    dispose() {
      receipt = undefined
    },
  }
}
