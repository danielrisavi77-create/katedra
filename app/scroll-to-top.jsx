'use client'

import { useEffect, useState } from 'react'

const SHOW_AFTER = 360

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const updateVisibility = () => setVisible(window.scrollY > SHOW_AFTER)
    let frame = 0

    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        updateVisibility()
      })
    }

    updateVisibility()
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  const scrollToTop = () => {
    const reducedMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches

    window.scrollTo({
      top: 0,
      behavior: reducedMotion ? 'auto' : 'smooth',
    })
  }

  if (!visible) return null

  return (
    <button
      type="button"
      className="global-scroll-top"
      onClick={scrollToTop}
      aria-label="Vrati se na vrh"
      title="Na vrh"
    >
      <span aria-hidden="true">↑</span>
    </button>
  )
}
