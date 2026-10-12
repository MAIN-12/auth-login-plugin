import AuthPagesClient from '.'
import type { AuthPagesProps as ClientAuthPagesProps } from '.'
import type { PublicAuthConfig } from '../../../shared/contracts/publicConfig'
import { AuthConfigProvider } from '../../../authentication/interface/react/providers/AuthConfigProvider/index'
import { AuthSignupConfig } from '../../../authentication/interface/react/providers/AuthSignupConfig/index'
import { AuthPresentationDefaults } from '../../../contexts/AuthAppearanceContext'
import { getServerPresentationDefaults } from '../../../authentication/interface/react/providers/AuthProviderServer/defaults'

export type AuthPagesProps = ClientAuthPagesProps & { publicConfig: PublicAuthConfig }

/** Server settings feed the card internally; signup visibility never changes the URL. */
export default async function AuthPages({ publicConfig, ...props }: AuthPagesProps) {
  const presentation = await getServerPresentationDefaults(publicConfig)
  return (
    <AuthConfigProvider publicConfig={publicConfig}>
      <AuthPresentationDefaults value={presentation}>
        <AuthSignupConfig enabled={publicConfig.allowSignup}>
          <AuthPagesClient
            {...props}
            showGoogleOAuth={props.showGoogleOAuth ?? publicConfig.googleOAuthEnabled}
            passwordLogin={props.passwordLogin ?? publicConfig.passwordLogin}
            otpLogin={props.otpLogin ?? publicConfig.otpLogin}
          />
        </AuthSignupConfig>
      </AuthPresentationDefaults>
    </AuthConfigProvider>
  )
}
