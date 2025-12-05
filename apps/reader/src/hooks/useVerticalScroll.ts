import { useEffect, useRef } from 'react'
import { BookTab } from '../models'

interface UseVerticalScrollOptions {
  tab: BookTab
  iframe?: Window
  enabled: boolean
}

/**
 * Hook to enable smooth vertical scrolling on mobile devices
 * Maps vertical scroll gestures to page navigation with smooth transitions
 */
export function useVerticalScroll({ tab, iframe, enabled }: UseVerticalScrollOptions) {
  const scrollStateRef = useRef({
    isScrolling: false,
    startY: 0,
    currentY: 0,
    velocity: 0,
    lastTime: 0,
  })

  useEffect(() => {
    if (!enabled || !iframe) return

    let animationFrameId: number | null = null
    let touchStartTime = 0

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (!touch) return

      scrollStateRef.current = {
        isScrolling: true,
        startY: touch.clientY,
        currentY: touch.clientY,
        velocity: 0,
        lastTime: Date.now(),
      }
      touchStartTime = Date.now()
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!scrollStateRef.current.isScrolling) return

      const touch = e.touches[0]
      if (!touch) return

      const now = Date.now()
      const deltaTime = now - scrollStateRef.current.lastTime
      const deltaY = touch.clientY - scrollStateRef.current.currentY

      if (deltaTime > 0) {
        scrollStateRef.current.velocity = deltaY / deltaTime
      }

      scrollStateRef.current.currentY = touch.clientY
      scrollStateRef.current.lastTime = now

      // Prevent default scrolling
      e.preventDefault()
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!scrollStateRef.current.isScrolling) return

      const totalDeltaY = scrollStateRef.current.currentY - scrollStateRef.current.startY
      const touchDuration = Date.now() - touchStartTime
      const absVelocity = Math.abs(scrollStateRef.current.velocity)

      scrollStateRef.current.isScrolling = false

      // Check if it's a text selection gesture (long press or small movement)
      if (touchDuration > 500 || Math.abs(totalDeltaY) < 20) {
        return
      }

      // Determine if we should navigate based on distance and velocity
      const threshold = 50 // minimum swipe distance
      const velocityThreshold = 0.3 // minimum velocity

      if (Math.abs(totalDeltaY) > threshold || absVelocity > velocityThreshold) {
        if (totalDeltaY > 0) {
          // Swipe down - go to previous page
          tab.prev()
        } else {
          // Swipe up - go to next page
          tab.next()
        }
      }
    }

    // Add touch event listeners
    iframe.addEventListener('touchstart', handleTouchStart, { passive: false })
    iframe.addEventListener('touchmove', handleTouchMove, { passive: false })
    iframe.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      iframe.removeEventListener('touchstart', handleTouchStart)
      iframe.removeEventListener('touchmove', handleTouchMove)
      iframe.removeEventListener('touchend', handleTouchEnd)
      
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  }, [enabled, iframe, tab])
}
