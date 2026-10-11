import type { PublicAuthConfig } from '../../auth/contracts/publicConfig'
import type { AuthStyle, AuthCardTheme } from '../../auth/contracts/publicConfig'

/** Serializable defaults only. React adapters decide how the logo is rendered. */
export function getAuthAppearanceDefaults(config?: PublicAuthConfig | null): {
  theme: AuthCardTheme
  style: AuthStyle
  locale: string
  logoUrl: string | undefined
} {
  return {
    theme: config?.theme ?? 'inherit',
    style: config?.style ?? 'tailwind',
    locale: config?.locale ?? 'en',
    logoUrl: config?.logoUrl,
  }
}
