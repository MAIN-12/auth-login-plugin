import type { UiTranslations, DeepPartial } from '../ui/translations'
import type { AuthFormSlug } from '../forms/index'

export interface FormPropsContext {
  redirectTo: string
  onPasswordLogin: (credentials: { email: string; password: string }) => Promise<void>
  onSignup: (data: { name: string; email: string }) => Promise<void>
  basePath: string
  showGoogleOAuth: boolean
  allowSignup: boolean
  locale: string
  messages?: Record<string, DeepPartial<UiTranslations>>
  setDynamicTitle: (title: string | undefined) => void
  setDynamicSubtitle: (subtitle: string | undefined) => void
}

import type { LoginFormProps, SignupFormProps, ForgotPasswordFormProps, VerifyOtpFormProps, SetPasswordFormProps } from '../forms'
type FormProps = { login: LoginFormProps; signup: SignupFormProps; 'forgot-password': ForgotPasswordFormProps; 'verify-otp': VerifyOtpFormProps; 'set-password': SetPasswordFormProps }
export type FormConfig = { translationKey: keyof UiTranslations; getProps: (ctx: FormPropsContext) => FormProps[AuthFormSlug] }
type FormConfigs = { [K in AuthFormSlug]: { translationKey: keyof UiTranslations; getProps: (ctx: FormPropsContext) => FormProps[K] } }
export const FORM_CONFIGS: FormConfigs = {
  'login': {
    translationKey: 'login',
    getProps: (ctx) => ({
      onPasswordLogin: ctx.onPasswordLogin,
      redirectTo: ctx.redirectTo,
      showGoogleOAuth: ctx.showGoogleOAuth,
      signupUrl: ctx.allowSignup ? `${ctx.basePath}/signup` : undefined,
      locale: ctx.locale,
      messages: ctx.messages,
      onStepChange: (_: string, title: string, subtitle: string) => {
        ctx.setDynamicTitle(title)
        ctx.setDynamicSubtitle(subtitle)
      },
    }),
  },
  'signup': {
    translationKey: 'signup',
    getProps: (ctx) => ({
      onSignup: ctx.onSignup,
      showGoogleOAuth: ctx.showGoogleOAuth,
      loginUrl: `${ctx.basePath}/login`,
      verifyOtpUrl: `${ctx.basePath}/verify-otp`,
      locale: ctx.locale,
      messages: ctx.messages,
    }),
  },
  'forgot-password': {
    translationKey: 'forgotPassword',
    getProps: (ctx) => ({
      loginUrl: `${ctx.basePath}/login`,
      locale: ctx.locale,
      messages: ctx.messages,
    }),
  },
  'verify-otp': {
    translationKey: 'verifyOtp',
    getProps: (ctx) => ({
      loginUrl: `${ctx.basePath}/login`,
      locale: ctx.locale,
      messages: ctx.messages,
      onPurposeChange: (_: string, title: string, subtitle: string) => {
        ctx.setDynamicTitle(title)
        ctx.setDynamicSubtitle(subtitle)
      },
    }),
  },
  'set-password': {
    translationKey: 'setPassword',
    getProps: (ctx) => ({
      redirectTo: ctx.redirectTo,
      locale: ctx.locale,
      messages: ctx.messages,
    }),
  },
}
