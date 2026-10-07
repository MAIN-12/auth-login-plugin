'use client'

import React from 'react'
import { useAuthPresentation } from './auth-presentation/AuthPresentationContext'

export interface PoweredByProps {
  enabled?: boolean
  logoUrl?: string
  linkUrl?: string
  width?: number
  height?: number
  className?: string
}

// const Main12LogoSVG = ({ width = 28, height = 28 }: { width?: number; height?: number }) => (
//   <svg width={width} height={height} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
//     <rect width="100" height="100" rx="20" fill="#D5E855" />
//     <text x="50" y="68" textAnchor="middle" fontSize="52" fontWeight="700" fill="#1d1d1f" fontFamily="system-ui, sans-serif">12</text>
//   </svg>
// )

const Main12LogoSVG = ({ width = 28, height = 28 }: { width?: number; height?: number }) => (
  <svg
    viewBox="0 0 7.938 7.937"
    height={width}
    width={height}
    xmlSpace="preserve"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g style={{ display: 'inline' }}>
      <path
        d="M671.165-649.8h-7.867v7.867"
        style={{
          fill: '#4e5357',
          fillOpacity: 1,
          fillRule: 'nonzero',
          stroke: 'none',
          strokeWidth: 0.0516193,
        }}
        transform="translate(-330.646 331.775)scale(.50447)"
      />
      <path
        d="M655.431-649.8h7.867v-7.868"
        style={{
          fill: '#3e86b0',
          fillOpacity: 1,
          fillRule: 'nonzero',
          stroke: 'none',
          strokeWidth: 0.0516193,
        }}
        transform="translate(-330.646 331.775)scale(.50447)"
      />
    </g>
  </svg>
)

export const PoweredBy: React.FC<PoweredByProps> = (props) => {
  const presentation = useAuthPresentation({ poweredBy: props })
  const {
    enabled = true,
    logoUrl,
    linkUrl = 'https://main12.com',
    width = 28,
    height = 28,
  } = presentation.poweredBy ?? {}
  const { className = '' } = props
  if (!enabled) return null

  return (
    <div className={`mt-4 w-full flex justify-center transition-all duration-300 ${className}`}>
      <a
        href={linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center hover:opacity-80"
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Powered by"
            width={width}
            height={height}
            className="object-contain"
          />
        ) : (
          <Main12LogoSVG width={width} height={height} />
        )}
      </a>
    </div>
  )
}
