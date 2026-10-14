import {
  AuthCard as AuthCardClient,
  type AuthCardWithSlugProps,
  type AuthCardWithChildrenProps,
} from '.'
import type { PublicAuthConfig } from '../../../shared/contracts/publicConfig'
import { AuthConfigProvider } from '../../../authentication/interface/react/providers/AuthConfigProvider/index'
import { AuthSignupConfig } from '../../../authentication/interface/react/providers/AuthSignupConfig/index'
import { AuthPresentationDefaults } from '../../../contexts/AuthAppearanceContext'
import { getServerPresentationDefaults } from '../../../authentication/interface/react/providers/AuthProviderServer/defaults'

export type { AuthCardWithSlugProps, AuthCardWithChildrenProps }
export type AuthCardProps = (AuthCardWithSlugProps | AuthCardWithChildrenProps) & {
  publicConfig: PublicAuthConfig
}

/** Resolve plugin settings internally. A disabled signup slug renders Login without redirecting. */
export async function AuthCard({ publicConfig, ...props }: AuthCardProps) {
  const presentation = await getServerPresentationDefaults(publicConfig)
  const card =
    'slug' in props && props.slug !== undefined ? (
      <AuthCardClient
        {...props}
        showGoogleOAuth={props.showGoogleOAuth ?? publicConfig.googleOAuthEnabled}
        passwordLogin={props.passwordLogin ?? publicConfig.passwordLogin}
        otpLogin={props.otpLogin ?? publicConfig.otpLogin}
      />
    ) : (
      <AuthCardClient {...props} />
    )

  return (
    <AuthConfigProvider publicConfig={publicConfig}>
      <AuthPresentationDefaults value={presentation}>
        <AuthSignupConfig enabled={publicConfig.allowSignup}>{card}</AuthSignupConfig>
      </AuthPresentationDefaults>
    </AuthConfigProvider>
  )
}
