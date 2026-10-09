import type { ImgHTMLAttributes } from 'react'

/** Default authentication branding; callers own placement and source selection. */
export function AuthLogo({
  width = 180,
  height = 42,
  alt = '',
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  return <img {...props} alt={alt} width={width} height={height} />
}
