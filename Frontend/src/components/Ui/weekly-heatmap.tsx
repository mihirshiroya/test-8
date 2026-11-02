"use client"

import { Fragment, useMemo, useState } from "react"
import { type HeatCell, formatMinutes, localDayKey } from "./analytics-data"

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

type Slot = { key: string; date: Date; minutes: number; future: boolean }

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function startOfWeek(date: Date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return addDays(d, -((d.getDay() + 6) % 7))
}

function shortDate(date: Date) {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`
}

function cellBackground(minutes: number, max: number) {
  if (minutes <= 0) return "var(--color-surface)"
  const pct = Math.round(20 + (minutes / max) * 80)
  return `color-mix(in oklab, var(--color-primary) ${pct}%, var(--color-surface))`
}

export function WeeklyHeatmap({ cells, weeks = 12 }: { cells: HeatCell[]; weeks?: number }) {
  const [active, setActive] = useState<[number, number] | null>(null)

  const { columns, grid, max, totalMinutes, activeDays } = useMemo(() => {
    const minutesByDate = new Map(cells.map((c) => [c.date, c.minutes]))
    const today = new Date()
    const todayKey = localDayKey(today)
    const firstWeek = addDays(startOfWeek(today), -7 * (weeks - 1))

    const columns = Array.from({ length: weeks }, (_, w) => addDays(firstWeek, w * 7))
    const grid: Slot[][] = DAYS.map((_, d) =>
      columns.map((weekStart) => {
        const date = addDays(weekStart, d)
        const key = localDayKey(date)
        return {
          key,
          date,
          minutes: minutesByDate.get(key) ?? 0,
          future: key > todayKey,
        }
      }),
    )

    const flat = grid.flat().filter((s) => !s.future)
    return {
      columns,
      grid,
      max: Math.max(1, ...flat.map((s) => s.minutes)),
      totalMinutes: flat.reduce((sum, s) => sum + s.minutes, 0),
      activeDays: flat.filter((s) => s.minutes > 0).length,
    }
  }, [cells, weeks])

  const activeSlot = active ? grid[active[0]][active[1]] : null

  return (
    <section
      className="flex h-full min-h-0 flex-col border border-soft p-6 animate-fadeIn"
      aria-labelledby="weekly-heatmap-title"
    >
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="weekly-heatmap-title" className="text-heading-5 text-primary">
            Weekly heatmap
          </h3>
          <p
            className="mt-1 text-body-sm text-steel !font-inter !font-semibold tabular-nums"
            aria-live="polite"
          >
            {activeSlot
              ? `${DAYS[active![0]]}, ${shortDate(activeSlot.date)} · ${formatMinutes(activeSlot.minutes)}`
              : `${activeDays} active days · ${formatMinutes(totalMinutes)} in the last ${weeks} weeks`}
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-caption text-stone" aria-hidden="true">
          <span>Less</span>
          {[0, 0.25, 0.5, 0.75, 1].map((step) => (
            <span
              key={step}
              className="size-3"
              style={{ background: cellBackground(step * max, max) }}
            />
          ))}
          <span>More</span>
        </div>
      </div>

      <div className="no-scrollbar mt-6 flex min-h-0 flex-1 items-center overflow-x-auto">
        <div
          role="grid"
          aria-label="Focus minutes by weekday over recent weeks"
          className="grid w-full min-w-[480px] gap-[clamp(3px,0.5vw,6px)]"
          style={{ gridTemplateColumns: `2.5rem repeat(${weeks}, minmax(0, 1fr))` }}
          onMouseLeave={() => setActive(null)}
        >
          {grid.map((row, r) => (
            <Fragment key={DAYS[r]}>
              <div
                role="rowheader"
                className={`self-center text-micro transition-colors font-inter! ${
                  active?.[0] === r ? "font-medium text-primary" : "text-stone"
                }`}
              >
                {DAYS[r]}
              </div>
              {row.map((slot, c) => {
                if (slot.future) {
                  return (
                    <span
                      key={slot.key}
                      role="gridcell"
                      aria-hidden="true"
                      className="h-[clamp(18px,2.2vw,28px)] border border-dashed border-soft"
                    />
                  )
                }
                const isActive = active?.[0] === r && active?.[1] === c
                return (
                  <button
                    key={slot.key}
                    type="button"
                    role="gridcell"
                    aria-label={`${DAYS[r]}, ${shortDate(slot.date)}: ${formatMinutes(slot.minutes)}`}
                    className={`h-[clamp(18px,2.2vw,28px)] outline-none transition-transform duration-150 ${
                      isActive ? "scale-110 ring-2 ring-[var(--color-primary)]" : ""
                    }`}
                    style={{ background: cellBackground(slot.minutes, max) }}
                    onMouseEnter={() => setActive([r, c])}
                    onFocus={() => setActive([r, c])}
                    onBlur={() => setActive(null)}
                  />
                )
              })}
            </Fragment>
          ))}

          <div aria-hidden="true" />
          {columns.map((weekStart, c) => (
            <div
              key={weekStart.toISOString()}
              role="columnheader"
              className={`pt-1 text-center text-micro  font-inter! transition-colors ${
                active?.[1] === c ? "font-medium text-primary" : "text-stone"
              }`}
            >
              {c % 2 === 0 || active?.[1] === c ? shortDate(weekStart) : ""}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
