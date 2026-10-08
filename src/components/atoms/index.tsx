'use client'

import React, { lazy } from 'react'
import { VisualLoadingBoundary } from '../auth-presentation/VisualLoadingBoundary'
import { useAuthPresentation } from '../auth-presentation/AuthPresentationContext'
import * as Tailwind from './adapters/tailwind'

// Keep the optional HeroUI dependency behind the selected presentation adapter.
const HeroButton = lazy(() =>
  import('./adapters/hero').then((module) => ({ default: module.Button })),
)
const HeroInput = lazy(() =>
  import('./adapters/hero').then((module) => ({ default: module.Input })),
)
const HeroCard = lazy(() => import('./adapters/hero').then((module) => ({ default: module.Card })))
const HeroCardHeader = lazy(() =>
  import('./adapters/hero').then((module) => ({ default: module.CardHeader })),
)
const HeroCardContent = lazy(() =>
  import('./adapters/hero').then((module) => ({ default: module.CardContent })),
)
const HeroCardFooter = lazy(() =>
  import('./adapters/hero').then((module) => ({ default: module.CardFooter })),
)
const HeroCardTitle = lazy(() =>
  import('./adapters/hero').then((module) => ({ default: module.CardTitle })),
)
const HeroCardDescription = lazy(() =>
  import('./adapters/hero').then((module) => ({ default: module.CardDescription })),
)
const HeroDivider = lazy(() =>
  import('./adapters/hero').then((module) => ({ default: module.Divider })),
)
const HeroSpinner = lazy(() =>
  import('./adapters/hero').then((module) => ({ default: module.Spinner })),
)

export function Button(props: React.ComponentProps<typeof Tailwind.Button>) {
  const { style } = useAuthPresentation()
  return style === 'hero-ui' ? (
    <VisualLoadingBoundary>
      <HeroButton {...props} />
    </VisualLoadingBoundary>
  ) : (
    <Tailwind.Button {...props} />
  )
}

export function Input(props: React.ComponentProps<typeof Tailwind.Input>) {
  const { style } = useAuthPresentation()
  return style === 'hero-ui' ? (
    <VisualLoadingBoundary>
      <HeroInput {...props} />
    </VisualLoadingBoundary>
  ) : (
    <Tailwind.Input {...props} />
  )
}

export function Card(props: React.ComponentProps<typeof Tailwind.Card>) {
  const { style } = useAuthPresentation()
  return style === 'hero-ui' ? (
    <VisualLoadingBoundary>
      <HeroCard {...props} />
    </VisualLoadingBoundary>
  ) : (
    <Tailwind.Card {...props} />
  )
}

export function CardHeader(props: React.ComponentProps<typeof Tailwind.CardHeader>) {
  const { style } = useAuthPresentation()
  return style === 'hero-ui' ? (
    <VisualLoadingBoundary>
      <HeroCardHeader {...props} />
    </VisualLoadingBoundary>
  ) : (
    <Tailwind.CardHeader {...props} />
  )
}

export function CardContent(props: React.ComponentProps<typeof Tailwind.CardContent>) {
  const { style } = useAuthPresentation()
  return style === 'hero-ui' ? (
    <VisualLoadingBoundary>
      <HeroCardContent {...props} />
    </VisualLoadingBoundary>
  ) : (
    <Tailwind.CardContent {...props} />
  )
}

export function CardFooter(props: React.ComponentProps<typeof Tailwind.CardFooter>) {
  const { style } = useAuthPresentation()
  return style === 'hero-ui' ? (
    <VisualLoadingBoundary>
      <HeroCardFooter {...props} />
    </VisualLoadingBoundary>
  ) : (
    <Tailwind.CardFooter {...props} />
  )
}

export function CardTitle(props: React.ComponentProps<typeof Tailwind.CardTitle>) {
  const { style } = useAuthPresentation()
  return style === 'hero-ui' ? (
    <VisualLoadingBoundary>
      <HeroCardTitle {...props} />
    </VisualLoadingBoundary>
  ) : (
    <Tailwind.CardTitle {...props} />
  )
}

export function CardDescription(props: React.ComponentProps<typeof Tailwind.CardDescription>) {
  const { style } = useAuthPresentation()
  return style === 'hero-ui' ? (
    <VisualLoadingBoundary>
      <HeroCardDescription {...props} />
    </VisualLoadingBoundary>
  ) : (
    <Tailwind.CardDescription {...props} />
  )
}

export function Divider(props: React.ComponentProps<typeof Tailwind.Divider>) {
  const { style } = useAuthPresentation()
  return style === 'hero-ui' ? (
    <VisualLoadingBoundary>
      <HeroDivider {...props} />
    </VisualLoadingBoundary>
  ) : (
    <Tailwind.Divider {...props} />
  )
}

export function Spinner(props: React.ComponentProps<typeof Tailwind.Spinner>) {
  const { style } = useAuthPresentation()
  return style === 'hero-ui' ? (
    <VisualLoadingBoundary>
      <HeroSpinner {...props} />
    </VisualLoadingBoundary>
  ) : (
    <Tailwind.Spinner {...props} />
  )
}
