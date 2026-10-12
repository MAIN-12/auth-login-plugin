export interface OtpCodec {
  keyed(value: string): string
  seal(code: string, binding: string): string
  open(ciphertext: string, binding: string): string
  matches(actual: string, expected: string): boolean
  random(): string
  context(): string
}
export interface OtpAccepted {
  success: true
  code: 'OTP_REQUEST_ACCEPTED'
  context: string
  retryAfter: number
}
export interface OtpProtocol<T> {
  send(input: unknown, origin: string | null): Promise<OtpAccepted>
  verify(input: unknown): Promise<T>
}
export interface OtpChallenge {
  accountID?: unknown
  context?: unknown
  expiresAt?: unknown
  attempts?: unknown
  consumed?: unknown
  ciphertext?: unknown
  verifier?: unknown
}
export interface OtpBudget {
  times?: unknown
  sentAt?: unknown
}
export interface OtpChallengeState {
  readChallenge(key: string): Promise<OtpChallenge | undefined>
  writeChallenge(key: string, value: OtpChallenge): Promise<void>
}
export interface OtpLedgerState extends OtpChallengeState {
  readBudget(key: string): Promise<OtpBudget | undefined>
  writeBudget(key: string, value: OtpBudget): Promise<void>
}
export interface OtpLedger {
  reserve<T>(keys: string[], work: (state: OtpLedgerState) => Promise<T>): Promise<T>
  consume<T>(key: string, work: (state: OtpChallengeState) => Promise<T>): Promise<T>
}
export interface OtpProtocolDependencies<T> {
  purpose?: 'login' | 'signup' | 'recovery' | 'reauth' | 'verify-email'
  codec: OtpCodec
  collection: string
  challengeGeneration?: string
  ledger: OtpLedger
  now: () => number
  random?: () => string
  context?: () => string
  quotaIdentity?: (account: string | number) => string | number
  findAccount: (email: string) => Promise<string | number | null>
  deliver: (mail: { email: string; code: string }) => Promise<void>
  session: (account: string | number, email: string) => Promise<T>
  event: (
    event: 'limited' | 'mail_failed' | 'send' | 'verify_failed' | 'unavailable',
    correlation: string,
  ) => void
  ttlSeconds?: number
  cooldownSeconds?: number
  maxAttempts?: number
  accountLimit?: number
  originLimit?: number
}
