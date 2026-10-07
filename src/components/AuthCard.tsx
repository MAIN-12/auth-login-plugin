'use client'

import { AuthConfigContext } from './AuthConfigContext'
import React, { Suspense } from 'react'
import { AuthCardLoadingContext, AuthLoadingIndicator } from './auth-card/AuthLoadingBoundary'
import { AuthCardReveal } from './auth-card/AuthCardReveal'
import type { AuthPresentationProps } from './auth-presentation/types'
import {
  AuthPresentationContext,
  useAuthPresentation,
} from './auth-presentation/AuthPresentationContext'
import { AuthCardShell, FormRenderer } from './auth-card/index'

export interface AuthCardConfig extends AuthPresentationProps {
  cardClassName?: string
  removeBorder?: boolean
  removeShadow?: boolean
  mobileVariant?: 'plain' | 'card' | 'modal'
}

export interface AuthCardWithSlugProps extends AuthCardConfig {
  slug: string | string[]
  redirectTo?: string
  onPasswordLogin?: (credentials: { email: string; password: string }) => Promise<void>
  onSignup?: (data: { name: string; email: string }) => Promise<void>
  basePath?: string
  showGoogleOAuth?: boolean
  passwordLogin?: boolean
  otpLogin?: boolean
  footer?: React.ReactNode
  title?: string
  subtitle?: string
}

export interface AuthCardWithChildrenProps extends AuthCardConfig {
  children: React.ReactNode
  footer?: React.ReactNode
  title?: string
  subtitle?: string
}

export type AuthCardProps = AuthCardWithSlugProps | AuthCardWithChildrenProps

function hasSlug(props: AuthCardProps): props is AuthCardWithSlugProps {
  return 'slug' in props && props.slug !== undefined
}

export const AuthCard: React.FC<AuthCardProps> = (props) => {
  const presentation = useAuthPresentation(props)
  const config = React.useContext(AuthConfigContext)
  const scopedConfig = React.useMemo(
    () =>
      config
        ? Object.freeze({
            ...config,
            locale: presentation.locale === 'es' ? ('es' as const) : ('en' as const),
          })
        : null,
    [config, presentation.locale],
  )
  const content = hasSlug(props) ? (
    <FormRenderer {...props} />
  ) : (
    <AuthCardShell {...props}>{props.children}</AuthCardShell>
  )

  return (
    <AuthConfigContext.Provider value={scopedConfig}>
      <AuthPresentationContext.Provider value={presentation}>
        <div
          style={{
            width: '100%',
            minHeight: 'min(28rem, 70svh)',
            display: 'grid',
            alignItems: 'center',
          }}
        >
          <Suspense fallback={<AuthLoadingIndicator />}>
            <AuthCardLoadingContext.Provider value={true}>
              <AuthCardReveal>{content}</AuthCardReveal>
            </AuthCardLoadingContext.Provider>
          </Suspense>
        </div>
      </AuthPresentationContext.Provider>
    </AuthConfigContext.Provider>
  )
}
