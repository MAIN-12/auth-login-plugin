import { generateOtpEmail } from './otp'
import type {
  PasswordResetEmailParams,
  PasswordResetEmailResult,
} from '../../../domain/emailTemplates'
export type {
  PasswordResetEmailParams,
  PasswordResetEmailResult,
} from '../../../domain/emailTemplates'

/** Manual recovery emails use the same lifetime and semantic content as runtime recovery. */
export function generatePasswordResetEmail(
  params: PasswordResetEmailParams,
): PasswordResetEmailResult {
  return generateOtpEmail({ ...params, purpose: 'password-reset' })
}
