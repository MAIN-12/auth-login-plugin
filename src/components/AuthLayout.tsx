'use client'

import React from 'react'
import { Card, CardContent, CardFooter } from './ui/index.js'
import { PoweredBy } from './PoweredBy.js'

export interface AuthLayoutConfig {
  logo: React.ReactNode
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
  return (
    <main className={`flex flex-col min-h-screen ${backgroundClass}`}>
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px] animate-[fadeIn_0.5s_ease-out]">
          <Card className={cardClassName}>
            {(logo || title) && (
              <div className="flex flex-col items-center gap-2 pt-6 pb-2 px-6">
                {logo && <div className="flex justify-center mb-2">{logo}</div>}
                {title && <h1 className="text-xl font-semibold text-gray-900 text-center">{title}</h1>}
                {subtitle && <p className="text-gray-600 text-sm text-center">{subtitle}</p>}
              </div>
            )}
            <CardContent>
              {children}
            </CardContent>
            {footer && <CardFooter>{footer}</CardFooter>}
          </Card>
          <PoweredBy {...poweredBy} />
        </div>
      </div>
    </main>
  )
}