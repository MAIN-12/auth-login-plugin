'use client'

import React from 'react'
import { AuthPageTexture, type AuthTexture } from './AuthPageTexture'
export type { AuthTexture } from './AuthPageTexture'

export interface AuthLayoutConfig {
  backgroundClass?: string
  /** Transparent page decoration. Disabled by default; never applied to modals. */
  texture?: AuthTexture
  /**
   * Vertical placement of the content within the viewport.
   * Defaults to `'center'`; pass `'top'` to align content to the top instead.
   */
  verticalAlign?: 'center' | 'top'
}

export interface AuthLayoutProps extends AuthLayoutConfig {
  children: React.ReactNode
}

/**
 * The outermost auth page wrapper — background + full-height container only.
 * Compose it with `<AuthCard>` (and any other elements, e.g. a split-screen
 * image) for the actual content:
 *
 * ```tsx
 * <AuthLayout backgroundClass="bg-accent">
 *   <AuthCard title="Welcome Back">{children}</AuthCard>
 * </AuthLayout>
 * ```
 *
 * For split/left/right layouts, just wrap `<AuthCard>` in your own grid or
 * flex container — `AuthCard` centers itself within whatever space it's given:
 *
 * ```tsx
 * <AuthLayout backgroundClass="bg-white">
 *   <div className="min-h-screen grid md:grid-cols-2">
 *     <div className="hidden md:block bg-cover" style={{ backgroundImage: 'url(/hero.jpg)' }} />
 *     <AuthCard removeShadow title="Create Account">{children}</AuthCard>
 *   </div>
 * </AuthLayout>
 * ```
 *
 * Content is vertically centered in the viewport by default; pass
 * `verticalAlign="top"` to align it to the top instead.
 */
export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  backgroundClass = 'bg-accent',
  verticalAlign = 'center',
  texture = 'none',
}) => {
  return (
    <main style={{ position: 'relative', isolation: 'isolate' }} className={`flex flex-col min-h-screen ${backgroundClass}`}>
      {texture !== 'none' && <AuthPageTexture texture={texture} />}
      <div style={{ position: 'relative', zIndex: 1 }} className={`flex-1 flex flex-col ${verticalAlign === 'top' ? 'justify-start' : 'justify-center'}`}>
        {children}
      </div>
    </main>
  )
}