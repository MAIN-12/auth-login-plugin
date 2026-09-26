'use client'

import type { DeepPartial, UiTranslations } from './ui/translations'
import { AuthLayout, type AuthLayoutConfig } from './AuthLayout'
import { AuthCard, type AuthCardConfig, type AuthCardWithSlugProps } from './AuthCard'

export interface AuthPagesProps extends AuthCardConfig, AuthLayoutConfig {
  slug?: string[]
  redirectTo?: string
  onPasswordLogin?: (credentials: { email: string; password: string }) => Promise<void>
  onSignup?: (data: { name: string; email: string }) => Promise<void>
  basePath?: string
  showGoogleOAuth?: boolean
  allowSignup?: boolean
  passwordLogin?: boolean
  otpLogin?: boolean
  locale?: string
  messages?: Record<string, DeepPartial<UiTranslations>>
}

export default function AuthPages({
  backgroundClass,
  verticalAlign,
  slug,
  redirectTo = '/admin',
  logo,
  onPasswordLogin,
  onSignup,
  basePath = '/auth',
  showGoogleOAuth,
  allowSignup = true,
  passwordLogin = true,
  otpLogin = true,
  locale,
  messages,
  poweredBy,
  cardClassName,
  removeBorder,
  removeShadow,
  mobileVariant,
}: AuthPagesProps) {
  return (
    <AuthLayout backgroundClass={backgroundClass} verticalAlign={verticalAlign}>
      <AuthCard
        slug={slug?.[0] ?? 'login'}
        redirectTo={redirectTo}
        logo={logo}
        onPasswordLogin={onPasswordLogin}
        onSignup={onSignup}
        basePath={basePath}
        showGoogleOAuth={showGoogleOAuth}
        allowSignup={allowSignup}
        passwordLogin={passwordLogin}
        otpLogin={otpLogin}
        locale={locale}
        messages={messages}
        poweredBy={poweredBy}
        cardClassName={cardClassName}
        removeBorder={removeBorder}
        removeShadow={removeShadow}
        mobileVariant={mobileVariant}
      />
    </AuthLayout>
  )
}
