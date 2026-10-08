import type { CredentialCapabilities } from '../../domain/credentials'
import { AuthOperationFailure } from '../../domain/errors'
import type { Outcome } from '../models'
import type { NativeRefresh, OwnCapabilities } from '../ports/session'

export function createOwnCapabilities(port: OwnCapabilities) {
  return async (): Promise<Outcome<CredentialCapabilities>> => {
    try {
      return { ok: true, value: await port.readOwn() }
    } catch (error) {
      return {
        ok: false,
        code: error instanceof AuthOperationFailure ? error.code : 'AUTH_UNAVAILABLE',
      }
    }
  }
}

export function createSessionRefresh(port: NativeRefresh) {
  return async (): Promise<Outcome<{ expiresAt: number }>> => {
    try {
      return { ok: true, value: await port.refresh() }
    } catch (error) {
      return {
        ok: false,
        code: error instanceof AuthOperationFailure ? error.code : 'AUTH_UNAVAILABLE',
      }
    }
  }
}
