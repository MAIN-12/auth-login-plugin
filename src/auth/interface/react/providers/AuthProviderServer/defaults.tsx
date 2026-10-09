import { AuthLogo } from '../../../../../components/atoms/AuthLogo'
import { getAuthAppearanceDefaults } from '../../../../../configuration/authAppearance/defaults'
import type { PublicAuthConfig } from '../../../../contracts/publicConfig'
import type { ResolvedAuthPresentation } from '../../../../../configuration/authAppearance/types'
export async function getServerPresentationDefaults(
  settings: PublicAuthConfig,
): Promise<ResolvedAuthPresentation> {
  const { logoUrl, ...appearance } = getAuthAppearanceDefaults(settings)
  return {
    ...appearance,
    logo: logoUrl ? <AuthLogo src={logoUrl} className="object-contain" /> : undefined,
  }
}
