import type { EmailColors } from './auth/domain/emailPresentation'
import type { PayloadRequest } from 'payload'

export interface OtpOptions {
  /** Optional high-entropy server-only override (>=32 characters); otherwise derived from Payload secret. */
  secret?: string
  /** Trusted host-derived peer identity; never trust forwarding headers without explicit proxy validation. */
  origin: (req: PayloadRequest) => string | null | Promise<string | null>
  now?: () => number
  ttlSeconds?: number
  cooldownSeconds?: number
  maxAttempts?: number
  accountLimit?: number
  originLimit?: number
  email?: {
    from: string
    locale: 'es' | 'en'
    projectName?: string
    logoUrl?: string
    contactUrl?: string
    contactEmail?: string
    domain?: string
    colors?: Partial<EmailColors>
  }
}
