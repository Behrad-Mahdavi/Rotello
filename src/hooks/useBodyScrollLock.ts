'use client'

import { useEffect } from 'react'

let lockCount = 0
let originalOverflow = ''
let originalPaddingRight = ''
let originalPaddingLeft = ''

/**
 * Hook to lock background body scroll when a modal or overlay is open.
 * Supports nested modals via reference counting, and prevents layout shift
 * caused by the disappearing scrollbar.
 * 
 * @param isLocked Whether the scroll lock should currently be active (defaults to true)
 */
export function useBodyScrollLock(isLocked: boolean = true) {
  useEffect(() => {
    if (!isLocked || typeof window === 'undefined') return

    lockCount++

    if (lockCount === 1) {
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth
      const isRtl = document.documentElement.dir === 'rtl' || document.body.dir === 'rtl'
      originalOverflow = document.body.style.overflow
      originalPaddingRight = document.body.style.paddingRight
      originalPaddingLeft = document.body.style.paddingLeft

      document.body.style.overflow = 'hidden'
      if (scrollBarWidth > 0) {
        if (isRtl) {
          document.body.style.paddingLeft = `${scrollBarWidth}px`
        } else {
          document.body.style.paddingRight = `${scrollBarWidth}px`
        }
      }
    }

    return () => {
      lockCount = Math.max(0, lockCount - 1)
      if (lockCount === 0) {
        document.body.style.overflow = originalOverflow || ''
        document.body.style.paddingRight = originalPaddingRight || ''
        document.body.style.paddingLeft = originalPaddingLeft || ''
      }
    }
  }, [isLocked])
}
