import { AuthPages } from '@main12/auth-login/rsc'
import Logo from '../../../../components/Logo'
import SplitLoginDemo from '../../../../components/SplitLoginDemo'
import { authPluginOptions } from '../../../../plugins'

export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params

  // Demo: split layout for login page (image left, AuthCard right)
  if (slug?.[0] === 'login' || !slug?.length) {
    return <SplitLoginDemo />
  }

  // Default: full-page AuthPages for other routes.
  // AuthPages (server) already redirects /signup -> /login when allowSignup is disabled,
  // reading from the plugin's pluginConfig singleton - no need to duplicate that logic here.
  return (
    <AuthPages
      slug={slug}
      logo={<Logo />}
      allowSignup={authPluginOptions.allowSignup}
      backgroundClass="bg-white md:bg-accent"
    />
  )
}
