import { createHash, randomBytes } from 'node:crypto'
/** Preserve historical state/nonce/PKCE entropy and collection/generation key namespace. */
export function createGoogleCorrelationCrypto(namespace?: string) {
  return {
    random: () => randomBytes(32).toString('base64url'),
    key: (state: string) =>
      `google:${createHash('sha256')
        .update(namespace ? JSON.stringify([namespace, state]) : state)
        .digest('hex')}`,
  }
}
