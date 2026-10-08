import type { PublicAuthConfig } from '../../contracts/publicConfig'
export interface ClientPasswordProof {
  permit: string
  expiresAt: number
  purpose: 'signup' | 'recovery' | 'reauth'
}
const key = (config: PublicAuthConfig) =>
  `auth-login:permit:${config.apiPrefix}:${config.authEndpointPrefix}:${config.collection}`
/** Per-tab, bounded continuation only; never put permits in URLs, cookies or account-discovery state. */
export function storePasswordProof(
  config: PublicAuthConfig,
  proof: ClientPasswordProof | null,
): void {
  if (proof) sessionStorage.setItem(key(config), JSON.stringify(proof))
  else sessionStorage.removeItem(key(config))
}
export function readPasswordProof(config: PublicAuthConfig): ClientPasswordProof | null {
  if (typeof window === 'undefined') return null
  try {
    const proof = JSON.parse(
      sessionStorage.getItem(key(config)) ?? 'null',
    ) as ClientPasswordProof | null
    if (
      proof &&
      typeof proof.permit === 'string' &&
      proof.expiresAt > Date.now() &&
      ['signup', 'recovery', 'reauth'].includes(proof.purpose)
    )
      return proof
    storePasswordProof(config, null)
  } catch {
    /* A corrupted continuation is not authorization. */
  }
  return null
}
