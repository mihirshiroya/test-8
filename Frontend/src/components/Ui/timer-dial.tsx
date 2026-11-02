
import { useId, type ReactNode } from "react"

const VIEWBOX = 224
const STROKE = 7
const RADIUS = 99
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

interface TimerDialProps {
  progress?: number
  finished?: boolean
  children: ReactNode
}

export function TimerDial({
  progress = 0,
  finished = false,
  children,
}: TimerDialProps) {
  const gradientId = useId()
  const clamped = Math.min(100, Math.max(0, progress))
  const offset = CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE
  const angle = (clamped / 100) * 2 * Math.PI

  return (
    <div
      className="relative aspect-square w-full max-w-56 shrink-0"
      data-finished={finished}
    >
      <svg
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        className="size-full -rotate-90"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id={gradientId}
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor="#a74638"
            />
            <stop
              offset="38%"
              stopColor="#ff351b"
            />
            <stop
              offset="100%"
              stopColor="#ff351b"
            />
          </linearGradient>
        </defs>

        <circle
          cx="112"
          cy="112"
          r="111"
          fill="none"
          className="stroke-border stroke-3 stroke-slate-600/20"
        />

        <circle
          cx="112"
          cy="112"
          r={RADIUS}
          fill="none"
          stroke="transparent"
          strokeWidth={STROKE}
        />

        {clamped > 0 && (
          <>
            <circle
              cx="112"
              cy="112"
              r={RADIUS}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
            />

            <circle
              cx={112 + RADIUS * Math.cos(angle)}
              cy={112 + RADIUS * Math.sin(angle)}
              r="3.5"
              fill="#ffcf8a"
              className="drop-shadow-[0_0_3px_#ffcf8a]"
            />
          </>
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5">
        {children}
      </div>
    </div>
  )
}
