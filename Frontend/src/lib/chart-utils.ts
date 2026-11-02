import { useEffect, useRef, useState } from 'react'

export const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'] as const
export function chartColor(index: number, override?: string) {
  return override ?? CHART_COLORS[index % CHART_COLORS.length]
}
const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
export function formatNumber(value: number) { return numberFormatter.format(value) }
export function sum(values: number[]) { return values.reduce((total, value) => total + value, 0) }

/** Animates from the previous value to `target` with an ease-out curve. */
export function useCountUp(target: number, duration = 650, resetKey?: string, enabled = true) {
  const safeTarget = Number.isFinite(target) ? target : 0
  const [value, setValue] = useState(safeTarget)
  const current = useRef(safeTarget)
  const previousKey = useRef(resetKey)
  const reset = previousKey.current !== resetKey

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    const snap = () => {
      cancelAnimationFrame(frame)
      current.current = safeTarget
      setValue(safeTarget)
    }
    const keyChanged = previousKey.current !== resetKey
    previousKey.current = resetKey
    if (keyChanged || !enabled || duration <= 0 || media.matches || document.hidden) {
      snap()
      return
    }
    const from = current.current
    if (from === safeTarget) return
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      current.current = from + (safeTarget - from) * eased
      setValue(current.current)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    const onVisibility = () => { if (document.hidden) snap() }
    const onMotion = () => { if (media.matches) snap() }
    frame = requestAnimationFrame(tick)
    document.addEventListener('visibilitychange', onVisibility)
    media.addEventListener('change', onMotion)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', onVisibility)
      media.removeEventListener('change', onMotion)
    }
  }, [safeTarget, duration, resetKey, enabled])

  return reset || !enabled ? safeTarget : value
}
