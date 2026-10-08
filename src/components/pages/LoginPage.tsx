'use client'
import React from 'react'
import { LoginForm } from '../organisms/LoginForm'
import { useAuthTranslations } from '../auth-presentation/AuthPresentationContext'
import { AuthLayout } from '../templates/AuthLayout'
import { AuthCard } from '../organisms/AuthCard'
import { useAuthConfig } from '../AuthConfigContext'
import type { AuthLayoutConfig } from '../templates/AuthLayout'
import type { AuthCardConfig } from '../organisms/AuthCard'

export interface LoginPageProps extends AuthLayoutConfig, AuthCardConfig {
  onPasswordLogin: (credentials: { email: string; password: string }) => Promise<void>
  redirectTo?: string
  showGoogleOAuth?: boolean
  signupUrl?: string
}

export default function LoginPage(props: LoginPageProps) {
  const config = useAuthConfig()
  return (
    <LoginPageContent
      signupUrl={`${config.authBasePath}/signup`}
      showGoogleOAuth={config.googleOAuthEnabled}
      {...props}
    />
  )
}
function LoginPageContent({
  onPasswordLogin,
  redirectTo,
  showGoogleOAuth,
  signupUrl,
  style,
  logo,
  poweredBy,
  cardClassName,
  removeBorder,
  removeShadow,
  mobileVariant,
  backgroundClass,
  texture,
  locale,
  messages,
}: LoginPageProps) {
  const t = useAuthTranslations(locale, messages).login
  return (
    <AuthLayout backgroundClass={backgroundClass} texture={texture}>
      <AuthCard
        style={style}
        logo={logo}
        title={t.title}
        subtitle={t.subtitle}
        poweredBy={poweredBy}
        cardClassName={cardClassName}
        removeBorder={removeBorder}
        removeShadow={removeShadow}
        mobileVariant={mobileVariant}
      >
        <LoginForm
          onPasswordLogin={onPasswordLogin}
          redirectTo={redirectTo}
          showGoogleOAuth={showGoogleOAuth}
          signupUrl={signupUrl}
          locale={locale}
          messages={messages}
        />
      </AuthCard>
    </AuthLayout>
  )
}
