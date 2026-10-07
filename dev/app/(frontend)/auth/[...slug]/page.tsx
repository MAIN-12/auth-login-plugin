import { AuthPages } from '@main12/auth-login/rsc'
import SplitLoginDemo from '../../../../components/SplitLoginDemo'
import TextureBackgroundLoginDemo from '../../../../components/TextureBackgroundLoginDemo'

export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params

  // if (slug?.[0] === 'login' || !slug?.length) return <SplitLoginDemo />
  if (slug?.[0] === 'login' || !slug?.length) return <TextureBackgroundLoginDemo />

  // Default: full-page AuthPages for other routes.
  // Disabled signup renders Login in the same card without changing the URL.
  return <AuthPages slug={slug} backgroundClass="bg-white md:bg-accent" />
}
