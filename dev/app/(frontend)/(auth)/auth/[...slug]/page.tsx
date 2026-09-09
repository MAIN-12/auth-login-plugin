import { AuthPages } from '@main12/auth-login/rsc'
import Logo from '../../../../../components/Logo'

export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params
  return <AuthPages 
        slug={slug} 
        logo={<Logo />} 
        backgroundClass="bg-white md:bg-blue-900"
        showGoogleOAuth={true}
    />
}