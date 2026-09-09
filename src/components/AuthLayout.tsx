'use client'

import React from 'react'
import { Card, CardContent, CardFooter } from './ui/index'
import { PoweredBy } from './PoweredBy'
import { pluginConfig } from '../config'

export interface AuthLayoutConfig {
  /** Component or URL. Falls back to pluginConfig when omitted. */
  logo?: React.ReactNode
  title?: string
  subtitle?: string
  poweredBy?: {
    enabled?: boolean
    logoUrl?: string
    linkUrl?: string
    width?: number
    height?: number
  }
  cardClassName?: string
  backgroundClass?: string
}

function DefaultLogo() {
  if (pluginConfig.Logo) { const L = pluginConfig.Logo; return <L /> }
  if (pluginConfig.logoUrl) return <img src={pluginConfig.logoUrl} alt="" width={180} height={42} className="object-contain" />
  return null
}

export interface AuthLayoutProps extends AuthLayoutConfig {
  children: React.ReactNode
  footer?: React.ReactNode
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  logo,
  title,
  subtitle,
  footer,
  poweredBy,
  cardClassName = '',
  backgroundClass = 'bg-white md:bg-[#191919]',
}) => {
  const displayLogo = logo || <DefaultLogo />

  const header = (displayLogo || title) && (
    <div className="flex flex-col items-center gap-2 pt-6 pb-2 px-6">
      {displayLogo && <div className="flex justify-center mb-2">{displayLogo}</div>}
      {title && <h1 className="text-xl font-semibold text-gray-900 text-center">{title}</h1>}
      {subtitle && <p className="text-gray-600 text-sm text-center">{subtitle}</p>}
    </div>
  )

  return (
    <main className={`flex flex-col min-h-screen ${backgroundClass}`}>

      <div className="md:hidden flex flex-col w-full max-w-md mx-auto light [color-scheme:light]" data-theme="light" style={{ maxWidth: '400px' }}>
        {header}
        <div className="px-6 pb-4">{children}</div>
        {footer && <div className="px-6 pb-6 flex justify-center">{footer}</div>}
        <PoweredBy {...poweredBy} />
      </div>

      <div className="hidden md:flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md max-w-[400px] animate-[fadeIn_0.5s_ease-out]" style={{ maxWidth: '400px' }}>
          <Card className={cardClassName}>
            {header}
            <CardContent>{children}</CardContent>
            {footer && <CardFooter>{footer}</CardFooter>}
          </Card>
          <PoweredBy {...poweredBy} />
        </div>
      </div>

    </main>
  )
}