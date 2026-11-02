
import { Clock, ListChecks, Target, Timer } from "lucide-react"
import {
  type ComparisonMode,
  type Metric,
  formatValue,
  metricValues,
} from "../Ui/analytics-data"

import { PixelShape } from "../Ui/pixel-shape"
import { ARROW_UP, ARROW_DOWN, PALETTE } from "../../lib/consistency"

const ORANGE = PALETTE.overview
const UP = PALETTE.session
const DIM = "#2a2a2a"

const ICONS = {
  focus: Clock,
  tasks: ListChecks,
  rate: Target,
  sessions: Timer,
} as const

export function StatCard({
  metric,
  mode,
  index = 0,
}: {
  metric: Metric
  mode: ComparisonMode
  index?: number
}) {
  const Icon = ICONS[metric.key]
  const { current, previous, delta } = metricValues(metric, mode)

  const isPositive = delta > 0
  const isNegative = delta < 0

  const periodLabel = mode === "today" ? "yesterday" : "last week"

  const up = isPositive
  const pixelRows = up ? ARROW_UP : ARROW_DOWN
  const pixelColor = up ? UP : ORANGE

  return (
    <div
      style={{ animationDelay: `${index * 60}ms` }}
      className="
        group relative overflow-hidden
        border border-soft
        bg-background
        p-6
        backdrop-blur-xl
        transition-all duration-300
      "
    >
      <style>{`
        @keyframes redrawPath {
          0% {
            stroke-dashoffset: 100;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
      `}</style>

      {/* Ambient Diffused Corner Glow */}
      <div
        className={`pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full blur-3xl transition-all duration-700 group-hover:scale-125 ${
          isPositive
            ? "bg-emerald-500/10 group-hover:bg-emerald-500/20 dark:bg-emerald-500/15 dark:group-hover:bg-emerald-500/25"
            : isNegative
              ? "bg-rose-500/10 group-hover:bg-rose-500/20 dark:bg-rose-500/15 dark:group-hover:bg-rose-500/25"
              : "bg-zinc-500/10 group-hover:bg-zinc-500/20 dark:bg-zinc-500/15 dark:group-hover:bg-zinc-500/25"
        }`}
      />

      {/* Top Hairline Sheen */}
      <div
        className="
          pointer-events-none absolute inset-x-0 top-0 h-px
          bg-gradient-to-r from-transparent via-black/10 to-transparent
          transition-opacity duration-500
          group-hover:via-black/20
          dark:via-white/20 dark:group-hover:via-white/40
        "
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between gap-3">
        <span
          className="
            text-xl font-semibold
            transition-colors
            group-hover:text-foreground
          "
        >
          {metric.label}
        </span>

        {/* Pixel Trend Icon */}
        <div className="flex size-9 shrink-0 items-center justify-center">
          {isPositive || isNegative ? (
            <PixelShape
              rows={pixelRows}
              color={pixelColor}
              cell={3}
              animation="drop"
            />
          ) : (
            <Icon className="size-6 text-secondary opacity-40" />
          )}
        </div>
      </div>

      {/* Primary Value */}
      <div className="relative z-10 mt-5 flex items-baseline gap-3">
        <span
          key={`${mode}-${current}`}
          className="
            text-3xl font-semibold tracking-tight
            text-foreground tabular-nums
          "
        >
          {formatValue(metric, current)}
        </span>

        <span
          className={`text-xs font-semibold tabular-nums !font-inter ${
            isPositive
              ? "text-emerald-600 dark:text-emerald-400"
              : isNegative
                ? "text-rose-600 dark:text-rose-400"
                : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          {isPositive ? "+" : ""}
          {delta}%
        </span>
      </div>

      {/* Comparison Subtext */}
      <div className="relative z-10 mt-2 flex items-center gap-2 text-xs text-secondary !font-inter">
        <span>
          vs {formatValue(metric, previous)} {periodLabel}
        </span>
      </div>

      {/* Static Chart at Bottom Right */}
      <div className="pointer-events-none absolute bottom-0 right-0 h-20 w-25">
        {isPositive ? (
          <svg
            viewBox="0 0 100 36"
            fill="none"
            className="h-full w-full"
          >
            <defs>
              <linearGradient
                id={`grad-pos-${metric.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#10b981"
                  stopOpacity="0.28"
                />
                <stop
                  offset="100%"
                  stopColor="#10b981"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>

            <path
              d="M 0 28 C 16 28, 24 32, 38 20 C 52 10, 60 22, 74 12 C 84 5, 92 8, 100 4 L 100 36 L 0 36 Z"
              fill={`url(#grad-pos-${metric.key})`}
              className="opacity-70 transition-opacity duration-300 group-hover:opacity-100"
            />

            <path
              d="M 0 28 C 16 28, 24 32, 38 20 C 52 10, 60 22, 74 12 C 84 5, 92 8, 100 4"
              fill="none"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset="0"
              className="
                stroke-emerald-500
                transition-all duration-300
                group-hover:[animation:redrawPath_0.85s_cubic-bezier(0.4,0,0.2,1)_forwards]
                dark:stroke-emerald-400
              "
            />
          </svg>
        ) : isNegative ? (
          <svg
            viewBox="0 0 100 36"
            fill="none"
            className="h-full w-full"
          >
            <defs>
              <linearGradient
                id={`grad-neg-${metric.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#f43f5e"
                  stopOpacity="0.28"
                />
                <stop
                  offset="100%"
                  stopColor="#f43f5e"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>

            <path
              d="M 0 8 C 16 8, 24 4, 38 14 C 52 24, 60 12, 74 22 C 84 29, 92 26, 100 32 L 100 36 L 0 36 Z"
              fill={`url(#grad-neg-${metric.key})`}
              className="opacity-70 transition-opacity duration-300 group-hover:opacity-100"
            />

            <path
              d="M 0 8 C 16 8, 24 4, 38 14 C 52 24, 60 12, 74 22 C 84 29, 92 26, 100 32"
              fill="none"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset="0"
              className="
                stroke-rose-500
                transition-all duration-300
                group-hover:[animation:redrawPath_0.85s_cubic-bezier(0.4,0,0.2,1)_forwards]
                dark:stroke-rose-400
              "
            />
          </svg>
        ) : (
          <svg
            viewBox="0 0 100 36"
            fill="none"
            className="h-full w-full"
          >
            <defs>
              <linearGradient
                id={`grad-eq-${metric.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#71717a"
                  stopOpacity="0.22"
                />
                <stop
                  offset="100%"
                  stopColor="#71717a"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>

            <path
              d="M 0 18 L 100 18 L 100 36 L 0 36 Z"
              fill={`url(#grad-eq-${metric.key})`}
              className="opacity-50 transition-opacity duration-300 group-hover:opacity-80"
            />

            <path
              d="M 0 18 L 100 18"
              fill="none"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset="0"
              className="
                stroke-zinc-400
                transition-all duration-300
                group-hover:[animation:redrawPath_0.85s_cubic-bezier(0.4,0,0.2,1)_forwards]
                dark:stroke-zinc-500
              "
            />
          </svg>
        )}
      </div>
    </div>
  )
}
