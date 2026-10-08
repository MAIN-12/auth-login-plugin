import { refreshOperation, type PayloadRequest } from 'payload'
import { AuthOperationFailure } from '../../domain/errors'
import { authenticationEvidenceCleanup } from './adminPolicy'
import { clearSessionPolicyRequest } from './sessionPolicy'
import { AuthFailure } from '../../contracts/errors'
import type { NativeRefresh } from '../../application/ports/session'

/** One request/attempt/receipt. Native coordination remains installed on Payload's DB adapter. */
export interface NativeRefreshAdapter {
  port: NativeRefresh
  takeReceipt(): Awaited<ReturnType<typeof refreshOperation>>
  dispose(): void
}
export function createNativeRefresh(
  req: PayloadRequest,
  collection: string,
  native: typeof refreshOperation = refreshOperation,
): NativeRefreshAdapter {
  const clearEvidence = authenticationEvidenceCleanup(req)
  const principal = req.user
  const id = principal?.id
  const sid = principal?._sid
  const payload = req.payload
  const headers = req.headers
  const isBound = () =>
    principal &&
    req.user === principal &&
    principal.id === id &&
    principal._sid === sid &&
    principal.collection === collection &&
    req.payload === payload &&
    req.headers === headers
  let receipt: Awaited<ReturnType<typeof refreshOperation>> | undefined
  let started = false
  const port: NativeRefresh = {
    async refresh() {
      if (started) throw new AuthOperationFailure('AUTH_UNAVAILABLE')
      started = true
      try {
        if (!isBound()) throw new AuthOperationFailure('AUTH_FAILED')
        receipt = await native({ collection: req.payload.collections[collection], req })
        if (!isBound() || receipt.user?.id !== id) throw new AuthOperationFailure('AUTH_FAILED')
        if (
          typeof receipt.refreshedToken !== 'string' ||
          !receipt.refreshedToken ||
          !Number.isFinite(receipt.exp)
        )
          throw new AuthOperationFailure('AUTH_UNAVAILABLE')
        return { expiresAt: receipt.exp }
      } catch (error) {
        receipt = undefined
        if (error instanceof AuthOperationFailure) throw error
        if (error instanceof AuthFailure) throw new AuthOperationFailure(error.code)
        const status =
          error !== null && typeof error === 'object' && 'status' in error
            ? error.status
            : undefined
        throw new AuthOperationFailure(
          status === 401 || status === 403 ? 'AUTH_FAILED' : 'AUTH_UNAVAILABLE',
        )
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
      started = true
      receipt = undefined
      clearSessionPolicyRequest(req)
      clearEvidence()
    },
  }
}
