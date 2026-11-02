import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, CircleAlert, CircleCheck, Info, Loader2, X } from 'lucide-react'

export type AppToastType = 'success' | 'error' | 'warning' | 'info' | 'loading'

export interface AppToastAction {
  label: ReactNode
  onClick: () => void
}

export interface AppToastProps {
  type: AppToastType
  title: ReactNode
  description?: ReactNode
  action?: AppToastAction
  /** Auto-close delay in ms. `Infinity` keeps the toast open. */
  duration: number
  showCountdown?: boolean
  onDismiss: () => void
}

const TONE: Record<AppToastType, { icon: typeof Info; color: string; label: string }> = {
  success: { icon: CircleCheck, color: '#4ade80', label: 'Success' },
  error: { icon: CircleAlert, color: '#f87171', label: 'Error' },
  warning: { icon: AlertTriangle, color: '#facc15', label: 'Warning' },
  info: { icon: Info, color: '#60a5fa', label: 'Info' },
  loading: { icon: Loader2, color: '#a1a1aa', label: 'Loading' },
}

export function AppToast({ type, title, description, action, duration, showCountdown, onDismiss }: AppToastProps) {
  const tone = TONE[type]
  const Icon = tone.icon
  const timed = Number.isFinite(duration) && duration > 0

  const [remainingMs, setRemainingMs] = useState(duration)
  const [stopped, setStopped] = useState(false)
  const [hovered, setHovered] = useState(false)
  const dismissedRef = useRef(false)

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return
    dismissedRef.current = true
    onDismiss()
  }, [onDismiss])

  const running = timed && !stopped && !hovered

  useEffect(() => {
    if (!running) return
    let last = performance.now()
    const interval = setInterval(() => {
      const now = performance.now()
      const delta = now - last
      last = now
      setRemainingMs((ms) => Math.max(0, ms - delta))
    }, 100)
    return () => clearInterval(interval)
  }, [running])

  useEffect(() => {
    if (timed && remainingMs <= 0) dismiss()
  }, [timed, remainingMs, dismiss])

  const seconds = Math.max(1, Math.ceil(remainingMs / 1000))
  const progress = timed ? Math.max(0, Math.min(1, remainingMs / duration)) : 0
  const footerVisible = timed && showCountdown

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="app-toast relative w-full overflow-hidden border border-white/[0.08] bg-[#18181a] text-left font-sans shadow-[0_12px_32px_-12px_rgba(0,0,0,0.6)]"
      style={{ '--toast-tone': tone.color } as React.CSSProperties}
    >
      <span aria-hidden="true" className="app-toast-glow pointer-events-none absolute inset-x-0 top-0 h-16" />
      <span aria-hidden="true" className="app-toast-edge pointer-events-none absolute inset-x-6 top-0 h-px" />

      <div className="relative flex items-start gap-3 px-4 pb-4 pt-3.5">
        <span className="mt-px shrink-0" style={{ color: tone.color }}>
          <Icon size={20} strokeWidth={1.75} className={type === 'loading' ? 'animate-spin' : undefined} aria-hidden="true" />
          <span className="sr-only">{tone.label}:</span>
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-5 text-zinc-100 text-pretty">{title}</p>
          {description ? (
            <p className="mt-1 text-[13px] leading-5 text-zinc-400 text-pretty">{description}</p>
          ) : null}
          {action ? (
            <button
              type="button"
              onClick={() => {
                action.onClick()
                dismiss()
              }}
              className="mt-3 inline-flex h-8 items-center rounded-md border border-white/10 bg-white/[0.06] px-3 text-[13px] font-medium text-zinc-100 transition-colors hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            >
              {action.label}
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Close notification"
          className="-mr-1 -mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>

      {footerVisible ? (
        <div className="relative border-t border-white/[0.04] bg-white/[0.025] px-4 py-2 text-xs text-zinc-500">
          {stopped ? (
            <span>Auto-close stopped.</span>
          ) : (
            <span>
              {'This message will close in '}
              <span className="tabular-nums">{seconds}</span>
              {seconds === 1 ? ' second. ' : ' seconds. '}
              <button
                type="button"
                onClick={() => setStopped(true)}
                className="font-medium text-zinc-200 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:underline"
              >
                Click to stop
              </button>
              .
            </span>
          )}
        </div>
      ) : null}

      {timed && !stopped ? (
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-0 h-0.5 rounded-full transition-[width] duration-100 ease-linear"
          style={{ width: `${progress * 100}%`, backgroundColor: tone.color, opacity: footerVisible ? 0.9 : 0.5 }}
        />
      ) : null}
    </div>
  )
}
