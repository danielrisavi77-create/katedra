'use client'

import { useEffect } from 'react'

export default function LandingMotion() {
  useEffect(() => {
    const root = document.querySelector('[data-landing-motion="true"]')
    if (!root) return undefined

    root.setAttribute('data-motion-ready', 'true')
    const items = Array.from(root.querySelectorAll('[data-reveal="true"]'))
    const revealAll = () => {
      items.forEach((item) => item.setAttribute('data-revealed', 'true'))
    }

    const reducedMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches
    const finePointer = window.matchMedia?.('(pointer: fine)').matches
    let removeParallax = () => {}

    if (!reducedMotion && finePointer) {
      let frame = 0
      let latestPoint = null
      const applyParallax = () => {
        frame = 0
        if (!latestPoint) return
        const x = (latestPoint.clientX / window.innerWidth - 0.5) * 12
        const y = (latestPoint.clientY / window.innerHeight - 0.5) * 8
        root.style.setProperty('--paper-shift-x', `${x.toFixed(2)}px`)
        root.style.setProperty('--paper-shift-y', `${y.toFixed(2)}px`)
      }
      const onPointerMove = (event) => {
        latestPoint = event
        if (!frame) frame = window.requestAnimationFrame(applyParallax)
      }
      const onPointerLeave = () => {
        latestPoint = null
        root.style.setProperty('--paper-shift-x', '0px')
        root.style.setProperty('--paper-shift-y', '0px')
      }

      root.setAttribute('data-parallax-ready', 'true')
      root.addEventListener('pointermove', onPointerMove, { passive: true })
      root.addEventListener('pointerleave', onPointerLeave)
      removeParallax = () => {
        root.removeEventListener('pointermove', onPointerMove)
        root.removeEventListener('pointerleave', onPointerLeave)
        if (frame) window.cancelAnimationFrame(frame)
        onPointerLeave()
      }
    }

    if (reducedMotion) {
      revealAll()
      return removeParallax
    }

    if (!('IntersectionObserver' in window)) {
      // IntersectionObserver unavailable: keep every landing element visible.
      revealAll()
      return removeParallax
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.setAttribute('data-revealed', 'true')
          observer.unobserve(entry.target)
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -7% 0px' },
    )

    items.forEach((item) => observer.observe(item))
    return () => {
      observer.disconnect()
      removeParallax()
    }
  }, [])

  return null
}
