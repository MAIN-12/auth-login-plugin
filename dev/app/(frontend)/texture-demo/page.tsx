import TextureBackgroundLoginDemo from '../../../components/TextureBackgroundLoginDemo'

export default async function TextureDemoPage({ searchParams }: {
  searchParams: Promise<{ texture?: string | string[] }>
}) {
  const { texture } = await searchParams
  return <TextureBackgroundLoginDemo texture={texture === 'none' || texture === 'spotlight-grid' ? texture : 'spotlight-dots'} />
}
