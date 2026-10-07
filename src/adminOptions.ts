import type { PayloadRequest } from 'payload'
export interface AuthenticationEvidence { method: 'password' | 'otp' | 'google'; authenticatedAt?: number; amr?: readonly string[] }
export interface AdminOptions {
  authorize: (args: { req: PayloadRequest; evidence: Readonly<AuthenticationEvidence> }) => boolean | Promise<boolean>
  collections: readonly { slug: string; operations: readonly ('read' | 'create' | 'update' | 'delete')[] }[]
  globals?: readonly { slug: string; operations: readonly ('read' | 'update')[] }[]
}
