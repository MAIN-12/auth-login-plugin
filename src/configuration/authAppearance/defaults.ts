import type { PublicAuthConfig } from '../../auth/contracts/publicConfig'
import type { AuthStyle } from '../../auth/contracts/publicConfig'

/** Serializable defaults only. React adapters decide how the logo is rendered. */
export function getAuthAppearanceDefaults(config?: PublicAuthConfig | null): {
  style: AuthStyle
  locale: string
  logoUrl: string | undefined
} {
  return {
    style: config?.style ?? 'tailwind',
    locale: config?.locale ?? 'en',
    logoUrl: config?.logoUrl,
  }
}
