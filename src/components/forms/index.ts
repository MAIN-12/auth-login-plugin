import { LoginForm } from '../organisms/LoginForm'
import { SignupForm } from '../organisms/SignupForm'
import { ForgotPasswordForm } from '../organisms/ForgotPasswordForm'
import { VerifyOtpForm } from '../organisms/VerifyOtpForm'
import { SetPasswordForm } from '../organisms/SetPasswordForm'

export { LoginForm, type LoginFormProps } from '../organisms/LoginForm'
export { SignupForm, type SignupFormProps } from '../organisms/SignupForm'
export { ForgotPasswordForm, type ForgotPasswordFormProps } from '../organisms/ForgotPasswordForm'
export { VerifyOtpForm, type VerifyOtpFormProps } from '../organisms/VerifyOtpForm'
export { SetPasswordForm, type SetPasswordFormProps } from '../organisms/SetPasswordForm'

export type AuthFormSlug = 'login' | 'signup' | 'forgot-password' | 'verify-otp' | 'set-password'

export const AUTH_FORMS = {
  login: LoginForm,
  signup: SignupForm,
  'forgot-password': ForgotPasswordForm,
  'verify-otp': VerifyOtpForm,
  'set-password': SetPasswordForm,
} as const

export function getFormBySlug(slug: string | string[] | undefined) {
  const normalizedSlug = Array.isArray(slug) ? slug[0] : slug
  return normalizedSlug && Object.hasOwn(AUTH_FORMS, normalizedSlug)
    ? AUTH_FORMS[normalizedSlug as AuthFormSlug]
    : LoginForm
}
