'use client'
import React from 'react'
import type { CardProps } from './types'
export const Card: React.FC<CardProps> = ({ children, className = '' }) => (
  <div
    className={`bg-white text-gray-900 rounded-2xl shadow-2xl w-full light [color-scheme:light] ${className}`}
    data-theme="light"
    style={{ maxWidth: '400px' }}
  >
    {children}
  </div>
)
