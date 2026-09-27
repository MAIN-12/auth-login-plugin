'use client'

import React, { Suspense } from 'react'
import { Spinner } from './ui/index'
import type { AuthPresentationProps } from './auth-presentation/types'
import { AuthPresentationContext, useAuthPresentation } from './auth-presentation/AuthPresentationContext'
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
  if (hasSlug(props)) {
    return (
      <AuthPresentationContext.Provider value={presentation}>
        <Suspense fallback={<div className="flex items-center justify-center py-12"><Spinner size="lg" /></div>}>
          <FormRenderer {...props} />
        </Suspense>
      </AuthPresentationContext.Provider>
    )
  }

  const { children, ...shellProps } = props as AuthCardWithChildrenProps

  return (
    <AuthPresentationContext.Provider value={presentation}>
      <AuthCardShell {...shellProps}>
        {children}
      </AuthCardShell>
    </AuthPresentationContext.Provider>
  )
}
