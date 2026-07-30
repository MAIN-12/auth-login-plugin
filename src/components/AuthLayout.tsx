'use client'

import React from 'react'
import { Card, CardContent, CardFooter } from './ui/index.js'
import { PoweredBy } from './PoweredBy.js'
import { pluginConfig } from '../config.js'

export interface AuthLayoutConfig {
  /** Logo as a React node. Falls back to pluginConfig.logoUrl if not provided. */
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
  if (!pluginConfig.logoUrl) return null
  return <img src={pluginConfig.logoUrl} alt="" width={180} height={42} className="object-contain" />
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

  return (
    <main className={`flex flex-col min-h-screen ${backgroundClass}`}>
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px] animate-[fadeIn_0.5s_ease-out]">
          <Card className={cardClassName}>
            {(displayLogo || title) && (
              <div className="flex flex-col items-center gap-2 pt-6 pb-2 px-6">
                {displayLogo && <div className="flex justify-center mb-2">{displayLogo}</div>}
                {title && <h1 className="text-xl font-semibold text-gray-900 text-center">{title}</h1>}
                {subtitle && <p className="text-gray-600 text-sm text-center">{subtitle}</p>}
              </div>
            )}
            <CardContent>{children}</CardContent>
            {footer && <CardFooter>{footer}</CardFooter>}
          </Card>
          <PoweredBy {...poweredBy} />
        </div>
      </div>
    </main>
  )
}