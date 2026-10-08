import type { ReactNode } from 'react'
import type { AuthStyle } from '../../auth/contracts/publicConfig'
import type { DeepPartial, UiTranslations } from '../ui/translations'

export interface AuthLocalizationProps {
  /** Shared UI language. Falls back to the explicit per-instance locale, then English. */
  locale?: string
  /** Partial dictionaries; more specific values override individual keys. */
  messages?: Record<string, DeepPartial<UiTranslations>>
}

export interface PoweredByConfig {
  enabled?: boolean
  logoUrl?: string
  linkUrl?: string
  width?: number
  height?: number
}

/** Presentation-only configuration. No session, routing, or API dependencies. */
export interface AuthPresentationProps extends AuthLocalizationProps {
  style?: AuthStyle
  /** AuthCard renders this node. Pass null to deliberately hide inherited branding. */
  logo?: ReactNode
  poweredBy?: PoweredByConfig
}

export interface ResolvedAuthPresentation extends AuthPresentationProps {
  locale: string
  style: AuthStyle
}
