'use client'

import React, { useState, useEffect } from 'react'
import type { Role } from '@/utils/database.types'

export interface UserAvatarProps {
  src?: string | null
  name?: string | null
  role?: Role | string | null
  size?: 'xs' | 'sm' | 'base' | 'md' | 'lg' | 'xl' | '2xl'
  shape?: 'circle' | 'rounded'
  className?: string
  alt?: string
  priority?: boolean
}

const SIZE_MAP = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-6 w-6 text-[10px]',
  base: 'h-7 w-7 text-[11px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-12 w-12 text-sm',
  xl: 'h-16 w-16 text-xl',
  '2xl': 'h-24 w-24 text-3xl',
}

export default function UserAvatar({
  src,
  name,
  role,
  size = 'base',
  shape = 'rounded',
  className = '',
  alt = '',
  priority = false,
}: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false)

  // Reset error state if the URL changes
  useEffect(() => {
    setImageFailed(false)
  }, [src])

  const initial = (name && name.trim().length > 0 ? name.trim().charAt(0) : '؟').toUpperCase()

  // Dynamic gradient based on role
  const gradientClass =
    role === 'admin'
      ? 'from-purple-600 to-indigo-700'
      : role === 'mentor'
      ? 'from-blue-600 to-cyan-700'
      : 'from-[#59BBAF] to-[#202A5A]'

  const shapeClass = shape === 'circle' ? 'rounded-full' : size === '2xl' || size === 'xl' || size === 'lg' ? 'rounded-2xl' : 'rounded-xl'

  const sizeClass = SIZE_MAP[size] || SIZE_MAP.base

  const showImage = Boolean(src && !imageFailed)

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden font-black text-white select-none ${sizeClass} ${shapeClass} ${
        !showImage ? `bg-gradient-to-br ${gradientClass}` : 'bg-surface-2'
      } border border-border/70 shadow-2xs ${className}`}
      title={name || undefined}
    >
      {showImage ? (
        <img
          src={src!}
          alt={alt || name || 'آواتار کاربر'}
          className="h-full w-full object-cover"
          loading={priority ? 'eager' : 'lazy'}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className="leading-none drop-shadow-2xs">{initial}</span>
      )}
    </div>
  )
}
