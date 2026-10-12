/** Explicit index seam for other collection owners. */
export { createOtpCodec, resolveOtpSecret } from './infrastructure/crypto/otpCodec'
export { createOtpLedger } from './infrastructure/repositories/otpLedger'
export type { OtpStore } from './infrastructure/repositories/otpLedger'
export { createPayloadOtpStore } from './infrastructure/repositories/otpStore'
export { AuthLoginOtpSecurity } from './config'
