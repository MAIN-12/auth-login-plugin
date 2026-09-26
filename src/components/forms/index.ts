import { LoginForm } from './LoginForm'
import { SignupForm } from './SignupForm'
import { ForgotPasswordForm } from './ForgotPasswordForm'
import { VerifyOtpForm } from './VerifyOtpForm'
import { SetPasswordForm } from './SetPasswordForm'

export { LoginForm, type LoginFormProps } from './LoginForm'
export { SignupForm, type SignupFormProps } from './SignupForm'
export { ForgotPasswordForm, type ForgotPasswordFormProps } from './ForgotPasswordForm'
export { VerifyOtpForm, type VerifyOtpFormProps } from './VerifyOtpForm'
export { SetPasswordForm, type SetPasswordFormProps } from './SetPasswordForm'

export type AuthFormSlug = 'login' | 'signup' | 'forgot-password' | 'verify-otp' | 'set-password'

export const AUTH_FORMS = {
  'login': LoginForm,
  'signup': SignupForm,
  'forgot-password': ForgotPasswordForm,
  'verify-otp': VerifyOtpForm,
  'set-password': SetPasswordForm,
} as const satisfies Record<AuthFormSlug, React.ComponentType<any>>

export function getFormBySlug(slug: string | string[] | undefined): React.ComponentType<any> {
  const normalizedSlug = Array.isArray(slug) ? slug[0] : slug
  return AUTH_FORMS[normalizedSlug as AuthFormSlug] ?? LoginForm
}
