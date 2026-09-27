import { AuthPages } from '@main12/auth-login/rsc'
import SplitLoginDemo from '../../../../components/SplitLoginDemo'

export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params

  if (slug?.[0] === 'login' || !slug?.length) return <SplitLoginDemo />


  // Default: full-page AuthPages for other routes.
  // Disabled signup renders Login in the same card without changing the URL.
  return (
    <AuthPages
      slug={slug}
      backgroundClass="bg-white md:bg-accent"
    />
  )
}
