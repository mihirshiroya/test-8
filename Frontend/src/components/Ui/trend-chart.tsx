import { useState } from "react"
import {
  type ComparisonMode,
  type SeriesPoint,
  formatMinutes,
} from "../Ui/analytics-data"
import { ThemedSvg } from "../../lib/svg-theme"
import growthChartRaw from "../../assets/18-growth-chart.svg?raw"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./empty"

// Inline SVG fractal noise texture for the grain effect
export const GRAIN_TEXTURE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E")`

export function TrendChart({
  mode,
  weekSeries,
  daySeries,
}: {
  mode: ComparisonMode
  weekSeries: SeriesPoint[]
  daySeries: SeriesPoint[]
}) {
  const data = mode === "today" ? daySeries : weekSeries
  const [hover, setHover] = useState<number | null>(null)

  const hasFocusTime = data.some((d) => d.current > 0 || d.previous > 0)
  const max = Math.max(...data.flatMap((d) => [d.current, d.previous]), 1)
  const currentLabel = mode === "today" ? "Today" : "This week"
  const prevLabel = mode === "today" ? "Yesterday" : "Last week"

  return (
    <div className="workspace-panel min-h-[360px] grid h-full grid-rows-[auto_1fr]">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-primary font-semibold">
              Focus time trends
            </span>
          </div>
        </div>

        {hasFocusTime && (
          <div className="flex items-center gap-4">
            <Legend
              gradientClass="bg-primary"
              label={currentLabel}
            />

            <Legend
              gradientClass="bg-surface"
              label={prevLabel}
              outline
            />
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="relative min-h-0 pt-8">
        {hasFocusTime ? (
          <div className="flex h-full items-stretch gap-2 sm:gap-3">
            {data.map((d, i) => {
            const active = hover === i

            return (
              <div
                key={d.label}
                className="group relative flex min-w-0 flex-1 flex-col"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                {/* Tooltip */}
                {active && (
                  <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap border border-color bg-canvas px-3 py-2 text-caption shadow-[var(--shadow-card)]">
                    <div className="text-caption-bold text-primary">
                      {d.label}
                    </div>

                    <div className="mt-1 flex items-center gap-1.5 text-secondary">
                      <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                      {currentLabel}: {formatMinutes(d.current)}
                    </div>

                    <div className="mt-0.5 flex items-center gap-1.5 text-steel">
                      <span className="inline-block h-2 w-2 rounded-full bg-gray-tint" />
                      {prevLabel}: {formatMinutes(d.previous)}
                    </div>
                  </div>
                )}

                {/* Bars */}
                <div className="flex min-h-0 flex-1 items-end justify-center gap-1.5">
                  {/* Previous Period Bar (Muted Grainy Gradient) */}
                  <div
                    className="relative w-1/2 max-w-8 overflow-hidden rounded-t-[5px] bg-surface transition-all duration-500 shadow-sm"
                    style={{
                      height: `${(d.previous / max) * 100}%`,
                    }}
                  >
                    {/* Grain Texture Overlay */}
                    <div
                      className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-50"
                      style={{ backgroundImage: GRAIN_TEXTURE }}
                    />
                    {/* Top edge subtle highlight */}
                    <div className="absolute inset-x-0 top-0 h-[1px] bg-white/20" />
                  </div>

                  {/* Current Period Bar (Vibrant Grainy Gradient) */}
                  <div
                    className={`relative w-1/2 max-w-8 overflow-hidden rounded-t-[5px] bg-primary transition-all duration-500 shadow-sm ${
                      active
                        ? "opacity-100 brightness-110 shadow-md"
                        : "opacity-95 hover:opacity-100"
                    }`}
                    style={{
                      height: `${(d.current / max) * 100}%`,
                    }}
                  >
                    {/* Grain Texture Overlay */}
                    <div
                      className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-60 contrast-125"
                      style={{ backgroundImage: GRAIN_TEXTURE }}
                    />
                    {/* Top edge glass shine */}
                    <div className="absolute inset-x-0 top-0 h-[1px] bg-white/40" />
                  </div>
                </div>

                {/* Label */}
                <span className="mt-2 shrink-0 text-center text-micro text-stone">
                  {d.label}
                </span>
              </div>
            )
            })}
          </div>
        ) : (
          <Empty size="lg" className="relative z-10 h-full border-0 p-0">
            <EmptyHeader>
              <EmptyMedia variant="illustration">
                <ThemedSvg raw={growthChartRaw} ariaLabel="Growth chart illustration" />
              </EmptyMedia>
              <EmptyTitle>No focus time recorded yet</EmptyTitle>
              <EmptyDescription className="text-steel">
                Start a focused task to see your time trends here.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent />
          </Empty>
        )}
      </div>
    </div>
  )
}

function Legend({
  gradientClass,
  label,
  outline,
}: {
  gradientClass: string
  label: string
  outline?: boolean
}) {
  return (
    <span className="flex items-center gap-1.5 text-caption text-steel">
      <span
        className={`relative h-2.5 w-2.5 overflow-hidden ${gradientClass} ${
          outline ? "border border-strong" : ""
        }`}
      >
        <span
          className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-50"
          style={{ backgroundImage: GRAIN_TEXTURE }}
        />
      </span>
      {label}
    </span>
  )
}
