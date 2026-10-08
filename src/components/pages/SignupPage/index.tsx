'use client'
import React from 'react'
import { SignupForm } from '../../organisms/SignupForm'
import { useAuthTranslations } from '../../../contexts/AuthAppearanceContext'
import { useAuthConfig } from '../../../auth/interface/react/providers/AuthConfigProvider'
import { AuthLayout, type AuthLayoutConfig } from '../../templates/AuthLayout'
import { AuthCard, type AuthCardConfig } from '../../organisms/AuthCard'
export interface SignupPageProps extends AuthLayoutConfig, AuthCardConfig {
  onSignup: (data: { name: string; email: string }) => Promise<void>
  showGoogleOAuth?: boolean
  loginUrl?: string
}
export default function SignupPage(props: SignupPageProps) {
  const config = useAuthConfig()
  return <SignupPageContent showGoogleOAuth={config.googleOAuthEnabled} {...props} />
}
function SignupPageContent({
  onSignup,
  showGoogleOAuth = false,
  loginUrl,
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
}: SignupPageProps) {
  const config = useAuthConfig()
  const t = useAuthTranslations(locale, messages).signup
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
        <SignupForm
          onSignup={onSignup}
          showGoogleOAuth={showGoogleOAuth}
          loginUrl={loginUrl}
          verifyOtpUrl={`${config.authBasePath}/verify-otp`}
          locale={locale}
          messages={messages}
        />
      </AuthCard>
    </AuthLayout>
  )
}
