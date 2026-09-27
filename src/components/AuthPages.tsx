'use client'

import { AuthLayout, type AuthLayoutConfig } from './AuthLayout'
import { AuthCard, type AuthCardConfig } from './AuthCard'

export interface AuthPagesProps extends AuthCardConfig, AuthLayoutConfig {
  slug?: string[]
  redirectTo?: string
  onPasswordLogin?: (credentials: { email: string; password: string }) => Promise<void>
  onSignup?: (data: { name: string; email: string }) => Promise<void>
  basePath?: string
  showGoogleOAuth?: boolean
  passwordLogin?: boolean
  otpLogin?: boolean
}

export default function AuthPages({
  style,
  backgroundClass,
  texture = 'spotlight-dots',
  verticalAlign,
  slug,
  redirectTo = '/admin',
  logo,
  onPasswordLogin,
  onSignup,
  basePath = '/auth',
  showGoogleOAuth,
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
    <AuthLayout texture={texture} backgroundClass={backgroundClass} verticalAlign={verticalAlign}>
      <AuthCard
        style={style}
        slug={slug?.[0] ?? 'login'}
        redirectTo={redirectTo}
        logo={logo}
        onPasswordLogin={onPasswordLogin}
        onSignup={onSignup}
        basePath={basePath}
        showGoogleOAuth={showGoogleOAuth}
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
