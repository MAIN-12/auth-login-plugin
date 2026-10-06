import type { PayloadRequest } from 'payload'

export interface OtpOptions {
  /** Dedicated high-entropy server-only key shared by every instance. */
  secret: string
  /** Trusted host-derived peer identity; never trust forwarding headers without explicit proxy validation. */
  origin: (req: PayloadRequest) => string | null | Promise<string | null>
  now?: () => number
  ttlSeconds?: number
  cooldownSeconds?: number
  maxAttempts?: number
  accountLimit?: number
  originLimit?: number
  email?: { from: string; locale: 'es' | 'en'; projectName?: string; logoUrl?: string; contactUrl?: string }
}
