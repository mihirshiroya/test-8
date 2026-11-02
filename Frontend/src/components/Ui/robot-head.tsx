'use client'

import { memo, useEffect, useRef, useState, type CSSProperties } from 'react'
export type RobotState = 'idle' | 'active' | 'thinking' | 'sleeping' | 'happy' | 'listening' | 'surprised' | 'error'

export interface RobotHeadProps {
  state?: RobotState
  color?: string
  size?: number
  blink?: boolean
  followCursor?: boolean
  paused?: boolean
  className?: string
}

export function useRobotPresence(state: RobotState, autoSleep = false, sleepAfter = 15000) {
  const [asleep, setAsleep] = useState(false)
  useEffect(() => {
    if (!autoSleep) return
    let timer: ReturnType<typeof setTimeout>
    const wake = () => {
      setAsleep(document.hidden)
      clearTimeout(timer)
      if (!document.hidden) timer = setTimeout(() => setAsleep(true), sleepAfter)
    }
    wake()
    window.addEventListener('pointermove', wake, { passive: true })
    window.addEventListener('pointerdown', wake, { passive: true })
    window.addEventListener('keydown', wake)
    document.addEventListener('visibilitychange', wake)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('pointermove', wake)
      window.removeEventListener('pointerdown', wake)
      window.removeEventListener('keydown', wake)
      document.removeEventListener('visibilitychange', wake)
    }
  }, [autoSleep, sleepAfter, state])
  return autoSleep && asleep ? 'sleeping' : state
}

export const RobotHead = memo(function RobotHead({ state = 'idle', color = '#f57747', size = 80, blink = true, followCursor = false, paused = false, className = '' }: RobotHeadProps) {
  const root = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const element = root.current
    if (!element) return
    const reset = () => {
      element.style.setProperty('--look-x', '0px')
      element.style.setProperty('--look-y', '0px')
    }
    if (!followCursor || paused || state === 'sleeping' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      reset()
      return
    }
    let frame = 0
    const move = (event: PointerEvent) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const bounds = element.getBoundingClientRect()
        const x = Math.max(-3, Math.min(3, (event.clientX - bounds.left - bounds.width / 2) / 130))
        const y = Math.max(-2, Math.min(2, (event.clientY - bounds.top - bounds.height / 2) / 160))
        element.style.setProperty('--look-x', `${x}px`)
        element.style.setProperty('--look-y', `${y}px`)
      })
    }
    window.addEventListener('pointermove', move, { passive: true })
    document.documentElement.addEventListener('pointerleave', reset)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', move)
      document.documentElement.removeEventListener('pointerleave', reset)
      reset()
    }
  }, [followCursor, paused, state])

  return (
    <span ref={root} role="img" aria-label={`Robot: ${state}`} className={`robot ${className}`} data-state={state} data-blink={blink} data-paused={paused} style={{ '--shell': color, width: size, height: size, '--robot-scale': size / 100 } as CSSProperties}>
      <span className="stage">
        <span className="shadow" />
        <span className="float">
          <span className="head">
            <span className="antenna"><span /></span>
            <span className="ear earLeft" />
            <span className="ear earRight" />
            <span className="shell">
              <span className="rim">
                <span className="screen">
                  <span className="face">
                    <span className="eye" />
                    <span className="eye" />
                    <span className="mouth" />
                    <span className="cheek cheekLeft" />
                    <span className="cheek cheekRight" />
                  </span>
                </span>
              </span>
              <span className="screw" />
              <span className="screw" />
            </span>
          </span>
          <span className="sparkles" aria-hidden="true"><span /><span /><span /></span>
          <span className="sleepMarks" aria-hidden="true"><span>z</span><span>z</span><span>Z</span></span>
        </span>
      </span>
    </span>
  )
})

export interface NotchRobotProps extends RobotHeadProps {
  autoSleep?: boolean
  sleepAfter?: number
  onInteract?: () => void
}

export function NotchRobot({ state = 'idle', size = 40, autoSleep = true, sleepAfter = 15000, onInteract, ...props }: NotchRobotProps) {
  const presentState = useRobotPresence(state, autoSleep, sleepAfter)
  const [greeting, setGreeting] = useState(false)
  useEffect(() => {
    if (!greeting) return
    const timer = setTimeout(() => setGreeting(false), 1800)
    return () => clearTimeout(timer)
  }, [greeting])

  return (
    <div className="notch">
      <span className="notchDot" />
      <button type="button" className="notchButton" aria-label="Say hello to your robot" onClick={() => { setGreeting(true); onInteract?.() }}>
        <RobotHead {...props} size={size} state={greeting ? 'happy' : presentState} />
      </button>
      <span className="notchSpeaker" />
    </div>
  )
}
