'use client'

import React, { Suspense } from 'react'
import { Spinner } from './ui/index'
import type { DeepPartial, UiTranslations } from './ui/translations'
import { AuthCardShell, FormRenderer, type PoweredByConfig } from './auth-card/index'

export interface AuthCardConfig {
  logo?: React.ReactNode
  poweredBy?: PoweredByConfig
  cardClassName?: string
  removeBorder?: boolean
  removeShadow?: boolean
  mobileVariant?: 'plain' | 'card'
}

export interface AuthCardWithSlugProps extends AuthCardConfig {
  slug: string | string[]
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
  if (hasSlug(props)) {
    return (
      <Suspense fallback={<div className="flex items-center justify-center py-12"><Spinner size="lg" /></div>}>
        <FormRenderer {...props} />
      </Suspense>
    )
  }

  const { children, ...shellProps } = props as AuthCardWithChildrenProps

  return (
    <AuthCardShell {...shellProps}>
      {children}
    </AuthCardShell>
  )
}
