'use client'

import React from 'react'
import { Card, CardContent, CardFooter } from '../ui/index'
import { useAuthThemeClasses } from '../ui/theme'
import { PoweredBy } from '../PoweredBy'
import { useAuthPresentation } from '../auth-presentation/AuthPresentationContext'
import type { PoweredByConfig } from '../auth-presentation/types'
export type { PoweredByConfig } from '../auth-presentation/types'

export interface AuthCardShellProps {
  children: React.ReactNode
  logo?: React.ReactNode
  title?: string
  subtitle?: string
  footer?: React.ReactNode
  poweredBy?: PoweredByConfig
  cardClassName?: string
  removeBorder?: boolean
  removeShadow?: boolean
  mobileVariant?: 'plain' | 'card' | 'modal'
}

export function AuthCardShell({
  children,
  logo,
  title,
  subtitle,
  footer,
  poweredBy,
  cardClassName = '',
  removeBorder = false,
  removeShadow = false,
  mobileVariant = 'plain',
}: AuthCardShellProps) {
  const presentation = useAuthPresentation({ logo, poweredBy })
  const displayLogo = presentation.logo
  const theme = useAuthThemeClasses()

  const header = (displayLogo || title) && (
    <div className="flex flex-col items-center gap-2 pt-8 pb-4 px-8">
      {displayLogo && <div className="flex justify-center mb-3">{displayLogo}</div>}
      {title && (
        <h1 className={`text-2xl font-bold ${theme.foreground} text-center tracking-tight`}>
          {title}
        </h1>
      )}
      {subtitle && <p className={`${theme.muted} text-sm text-center`}>{subtitle}</p>}
    </div>
  )

  const cardBorderShadowClass = [
    removeBorder ? '!border-0' : '',
    removeShadow ? '!shadow-none' : '',
    mobileVariant === 'plain' ? 'max-md:!border-0 max-md:!shadow-none' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const cardBody = (
    <div
      className="w-full max-w-[400px] mx-auto light"
      data-theme="light"
      style={{ maxWidth: '400px', colorScheme: 'light' }}
    >
      <Card className={`md:p-0 ${cardBorderShadowClass} ${cardClassName}`.trim()}>
        {header}
        <CardContent className="md:px-8 md:pb-8">{children}</CardContent>
        {footer && <CardFooter className="md:px-8 md:pb-8">{footer}</CardFooter>}
      </Card>
      <PoweredBy {...presentation.poweredBy} />
    </div>
  )

  if (mobileVariant === 'modal') return cardBody

  if (mobileVariant === 'card') {
    return <div className="px-4 py-8 md:py-12">{cardBody}</div>
  }

  return (
    <>
      <div
        className="md:hidden flex flex-col w-full max-w-[400px] mx-auto light [color-scheme:light] px-4 py-8"
        data-theme="light"
        style={{ maxWidth: '400px', colorScheme: 'light' }}
      >
        {header}
        <div className="px-8 pb-6">{children}</div>
        {footer && <div className="px-8 pb-8 flex justify-center">{footer}</div>}
        <PoweredBy {...presentation.poweredBy} />
      </div>
      <div className="hidden md:flex justify-center px-4 py-12 w-full">{cardBody}</div>
    </>
  )
}
