'use client'

import React, { lazy, Suspense } from 'react'
import type { AuthStyle } from '../../auth/contracts/publicConfig'
import { useAuthPresentation } from '../../contexts/AuthAppearanceContext'
import { VisualLoadingBoundary } from '../../components/atoms/VisualLoadingBoundary'

/** Resolve style in the current presentation scope, never in module/global state.
 * The HeroUI loader is not invoked until a HeroUI instance is rendered.
 */
export function withAuthStyle<Props extends object>(
  Tailwind: React.ComponentType<Props>,
  loadHero: () => Promise<{ default: React.ComponentType<Props> }>,
  options: { fallback?: 'visual' | 'none' } = {},
) {
  const Hero = lazy(loadHero)
  function AuthStyled({ style: override, ...props }: Props & { style?: AuthStyle }) {
    const { style } = useAuthPresentation()
    const visualProps = props as Props
    if ((override ?? style) !== 'hero-ui') return <Tailwind {...visualProps} />
    const content = <Hero {...visualProps} />
    // Modal pending state deliberately has no visible fallback. Visual children
    // inside an AuthCard defer to its single enclosing loading/reveal boundary.
    return options.fallback === 'none' ? (
      <Suspense fallback={null}>{content}</Suspense>
    ) : (
      <VisualLoadingBoundary>{content}</VisualLoadingBoundary>
    )
  }
  AuthStyled.displayName = `withAuthStyle(${Tailwind.displayName ?? Tailwind.name ?? 'Component'})`
  return AuthStyled
}
