'use client'

import React, { lazy } from 'react'
import { AuthLoadingBoundary } from '../auth-card/AuthLoadingBoundary'
import { useAuthPresentation } from '../auth-presentation/AuthPresentationContext'
import * as Tailwind from './tailwind'

// Keep the optional HeroUI dependency behind the selected presentation adapter.
const HeroButton = lazy(() => import('./hero').then(module => ({ default: module.Button })))
const HeroInput = lazy(() => import('./hero').then(module => ({ default: module.Input })))
const HeroCard = lazy(() => import('./hero').then(module => ({ default: module.Card })))
const HeroCardHeader = lazy(() => import('./hero').then(module => ({ default: module.CardHeader })))
const HeroCardContent = lazy(() => import('./hero').then(module => ({ default: module.CardContent })))
const HeroCardFooter = lazy(() => import('./hero').then(module => ({ default: module.CardFooter })))
const HeroCardTitle = lazy(() => import('./hero').then(module => ({ default: module.CardTitle })))
const HeroCardDescription = lazy(() => import('./hero').then(module => ({ default: module.CardDescription })))
const HeroDivider = lazy(() => import('./hero').then(module => ({ default: module.Divider })))
const HeroSpinner = lazy(() => import('./hero').then(module => ({ default: module.Spinner })))
const HeroOtpInput = lazy(() => import('./hero').then(module => ({ default: module.OtpInput })))

export function Button(props: React.ComponentProps<typeof Tailwind.Button>) {
  const { style } = useAuthPresentation()
  return style === 'hero-ui'
    ? <AuthLoadingBoundary><HeroButton {...props} /></AuthLoadingBoundary>
    : <Tailwind.Button {...props} />
}

export function Input(props: React.ComponentProps<typeof Tailwind.Input>) {
  const { style } = useAuthPresentation()
  return style === 'hero-ui'
    ? <AuthLoadingBoundary><HeroInput {...props} /></AuthLoadingBoundary>
    : <Tailwind.Input {...props} />
}

export function Card(props: React.ComponentProps<typeof Tailwind.Card>) {
  const { style } = useAuthPresentation()
  return style === 'hero-ui'
    ? <AuthLoadingBoundary><HeroCard {...props} /></AuthLoadingBoundary>
    : <Tailwind.Card {...props} />
}

export function CardHeader(props: React.ComponentProps<typeof Tailwind.CardHeader>) {
  const { style } = useAuthPresentation()
  return style === 'hero-ui'
    ? <AuthLoadingBoundary><HeroCardHeader {...props} /></AuthLoadingBoundary>
    : <Tailwind.CardHeader {...props} />
}

export function CardContent(props: React.ComponentProps<typeof Tailwind.CardContent>) {
  const { style } = useAuthPresentation()
  return style === 'hero-ui'
    ? <AuthLoadingBoundary><HeroCardContent {...props} /></AuthLoadingBoundary>
    : <Tailwind.CardContent {...props} />
}

export function CardFooter(props: React.ComponentProps<typeof Tailwind.CardFooter>) {
  const { style } = useAuthPresentation()
  return style === 'hero-ui'
    ? <AuthLoadingBoundary><HeroCardFooter {...props} /></AuthLoadingBoundary>
    : <Tailwind.CardFooter {...props} />
}

export function CardTitle(props: React.ComponentProps<typeof Tailwind.CardTitle>) {
  const { style } = useAuthPresentation()
  return style === 'hero-ui'
    ? <AuthLoadingBoundary><HeroCardTitle {...props} /></AuthLoadingBoundary>
    : <Tailwind.CardTitle {...props} />
}

export function CardDescription(props: React.ComponentProps<typeof Tailwind.CardDescription>) {
  const { style } = useAuthPresentation()
  return style === 'hero-ui'
    ? <AuthLoadingBoundary><HeroCardDescription {...props} /></AuthLoadingBoundary>
    : <Tailwind.CardDescription {...props} />
}

export function Divider(props: React.ComponentProps<typeof Tailwind.Divider>) {
  const { style } = useAuthPresentation()
  return style === 'hero-ui'
    ? <AuthLoadingBoundary><HeroDivider {...props} /></AuthLoadingBoundary>
    : <Tailwind.Divider {...props} />
}

export function Spinner(props: React.ComponentProps<typeof Tailwind.Spinner>) {
  const { style } = useAuthPresentation()
  return style === 'hero-ui'
    ? <AuthLoadingBoundary><HeroSpinner {...props} /></AuthLoadingBoundary>
    : <Tailwind.Spinner {...props} />
}

export function OtpInput(props: React.ComponentProps<typeof Tailwind.OtpInput>) {
  const { style } = useAuthPresentation()
  return style === 'hero-ui'
    ? <AuthLoadingBoundary><HeroOtpInput {...props} /></AuthLoadingBoundary>
    : <Tailwind.OtpInput {...props} />
}
