'use client'

import React from 'react'

export interface PoweredByProps {
  enabled?: boolean
  logoUrl?: string
  linkUrl?: string
  width?: number
  height?: number
  className?: string
}

const Main12LogoSVG = ({ width = 28, height = 28 }: { width?: number; height?: number }) => (
  <svg width={width} height={height} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#D5E855" />
    <text x="50" y="68" textAnchor="middle" fontSize="52" fontWeight="700" fill="#1d1d1f" fontFamily="system-ui, sans-serif">12</text>
  </svg>
)

export const PoweredBy: React.FC<PoweredByProps> = ({
  enabled = true,
  logoUrl,
  linkUrl = 'https://main12.com',
  width = 28,
  height = 28,
  className = '',
}) => {
  if (!enabled) return null

  return (
    <div className={`mt-4 w-full flex justify-center transition-all duration-300 ${className}`}>
      <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center hover:opacity-80">
        {logoUrl ? (
          <img src={logoUrl} alt="Powered by" width={width} height={height} className="object-contain" />
        ) : (
          <Main12LogoSVG width={width} height={height} />
        )}
      </a>
    </div>
  )
}