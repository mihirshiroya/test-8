'use client'

import { useEffect, useRef, type RefObject } from 'react'

type Listener = (entry: IntersectionObserverEntry) => void

const listeners = new WeakMap<Element, Listener>()
let sharedObserver: IntersectionObserver | null = null

// One observer for every pixel icon on the page instead of one per icon.
function getObserver() {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) listeners.get(entry.target)?.(entry)
      },
      { threshold: [0, 0.6] },
    )
  }
  return sharedObserver
}

export function useVisibilityListener(ref: RefObject<Element | null>, listener: Listener) {
  const latest = useRef(listener)
  latest.current = listener

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = getObserver()
    listeners.set(el, (entry) => latest.current(entry))
    observer.observe(el)
    return () => {
      observer.unobserve(el)
      listeners.delete(el)
    }
  }, [ref])
}

/**
 * Writes `data-entered` (once, at 60% visible) and `data-visible` straight to the DOM.
 * CSS reads these to start entry animations and pause loops offscreen — no React re-renders.
 */
export function usePixelVisibility(ref: RefObject<HTMLElement | null>) {
  useVisibilityListener(ref, (entry) => {
    const el = entry.target as HTMLElement
    el.dataset.visible = entry.isIntersecting ? 'true' : 'false'
    if (entry.intersectionRatio >= 0.55) el.dataset.entered = ''
  })
}
