"use client"

import { useMemo, useState } from "react"
import { type HeatCell, formatMinutes } from "./analytics-data"

const LEVEL_BG = [
  "var(--color-surface)",
  "color-mix(in oklab, var(--color-primary) 28%, var(--color-canvas))",
  "color-mix(in oklab, var(--color-primary) 52%, var(--color-canvas))",
  "color-mix(in oklab, var(--color-primary) 76%, var(--color-canvas))",
  "var(--color-primary-deep)",
]

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""]

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/**
 * Build a complete calendar year.
 *
 * The grid always starts on Sunday so that:
 *
 * Sunday
 * Monday
 * Tuesday
 * Wednesday
 * Thursday
 * Friday
 * Saturday
 *
 * line up correctly with the weekday labels.
 */
function buildYearGrid(year: number) {
  const start = new Date(year, 0, 1)
  const end = new Date(year, 11, 31)

  // Move back to the Sunday of the week containing Jan 1.
  const gridStart = addDays(start, -start.getDay())

  const weeks: Array<Array<Date | null>> = []

  for (
    let weekStart = new Date(gridStart);
    weekStart <= end;
    weekStart = addDays(weekStart, 7)
  ) {
    const week: Array<Date | null> = []

    for (let day = 0; day < 7; day++) {
      const date = addDays(weekStart, day)

      if (date >= start && date <= end) {
        week.push(date)
      } else {
        week.push(null)
      }
    }

    weeks.push(week)
  }

  return {
    weeks,
    start,
    end,
  }
}

export function ActivityHeatmap({
  cells,
  year,
}: {
  cells: HeatCell[]
  year?: number
}) {
  const [hover, setHover] = useState<HeatCell | null>(null)

  const currentYear = year ?? new Date().getFullYear()

  /*
   * Convert HeatCell[] into:
   *
   * {
   *   "2026-01-01": HeatCell,
   *   "2026-01-02": HeatCell,
   *   ...
   * }
   *
   * This makes looking up a calendar date extremely fast.
   */
  const cellsByDate = useMemo(() => {
    const map = new Map<string, HeatCell>()

    for (const cell of cells) {
      map.set(cell.date, cell)
    }

    return map
  }, [cells])

  /*
   * Only use cells belonging to the requested year
   * for the statistics shown in the header.
   */
  const yearCells = useMemo(() => {
    return cells.filter((cell) => {
      return cell.date.startsWith(`${currentYear}-`)
    })
  }, [cells, currentYear])

  const activeDays = yearCells.filter((cell) => cell.value > 0).length

  const totalMinutes = yearCells.reduce(
    (sum, cell) => sum + cell.minutes,
    0,
  )

  /*
   * Build the actual calendar.
   *
   * Unlike the old implementation, this does NOT simply
   * split cells into groups of 7.
   *
   * It creates the actual Jan-Dec calendar structure.
   */
  const { weeks } = useMemo(() => {
    return buildYearGrid(currentYear)
  }, [currentYear])

  /*
   * Determine which week columns should display month labels.
   *
   * Example:
   * Jan       Feb       Mar
   * |         |         |
   * □ □ □     □ □ □     □ □ □
   */
  const monthLabels = useMemo(() => {
    const labels = new Map<number, string>()

    weeks.forEach((week, weekIndex) => {
      for (const date of week) {
        if (date && date.getDate() === 1) {
          labels.set(weekIndex, MONTHS[date.getMonth()])
          break
        }
      }
    })

    return labels
  }, [weeks])

  return (
  <section
  className="border border-soft animate-fadeIn p-6 h-full flex flex-col min-h-0"
  aria-labelledby="heatmap-title"
>
  {/* Header */}
  <div className="flex flex-wrap items-start justify-between gap-3 shrink-0">
    <div>
      <h3
        id="heatmap-title"
        className="text-heading-5 text-primary"
      >
        Consistency heatmap
      </h3>

      <p className="mt-1 text-body-sm text-steel !font-semibold !font-inter">
        {activeDays} active days ·{" "}
        {formatMinutes(totalMinutes)} focused in {currentYear}
      </p>
    </div>

    {/* Legend */}
    <div className="flex items-center gap-1.5 text-caption text-stone">

      {LEVEL_BG.map((bg, index) => (
        <span
          key={index}
          className="h-3 w-3"
          style={{ backgroundColor: bg }}
          aria-hidden="true"
        />
      ))}
    </div>
  </div>

  {/* Calendar */}
<div className="mt-6 flex-1 min-h-0 flex items-center">
  <div className="flex w-full min-h-0">
    {/* Left weekday labels */}
    <div className="mr-3 flex shrink-0 flex-col justify-between py-1">
      {DAY_LABELS.map((day, index) => (
        <div
          key={index}
          className="flex items-center text-micro leading-none text-stone"
        >
          {day}
        </div>
      ))}
    </div>

    {/* Scrollable calendar */}
    <div className="no-scrollbar min-w-0 flex-1 overflow-x-auto">
      <div className="min-w-max">
        {/* Month labels */}
        <div
          className="mb-3 flex gap-[clamp(3px,0.5vw,6px)] ml-[clamp(2.5rem,5vw,4rem)]"
        >
          {weeks.map((_, weekIndex) => (
            <div
              key={weekIndex}
              className="
                shrink-0
                w-[clamp(14px,1.5vw,22px)]
                text-center
                text-micro
                text-stone
              "
            >
              {monthLabels.get(weekIndex) ?? ""}
            </div>
          ))}
        </div>

        {/* Heatmap */}
        <div className="flex gap-[clamp(3px,0.5vw,6px)]">
          {weeks.map((week, weekIndex) => (
            <div
              key={weekIndex}
              className="flex shrink-0 flex-col gap-[clamp(3px,0.5vw,6px)]"
            >
              {week.map((date, dayIndex) => {
                if (!date) {
                  return (
                    <span
                      key={`empty-${weekIndex}-${dayIndex}`}
                      className="
                        shrink-0
                        w-[clamp(14px,1.5vw,22px)]
                        h-[clamp(14px,1.5vw,22px)]
                      "
                      aria-hidden="true"
                    />
                  )
                }

                const dateKey = formatDate(date)
                const cell = cellsByDate.get(dateKey)

                const minutes = cell?.minutes ?? 0
                const value = cell?.value ?? 0

                const level = Math.min(
                  Math.max(value, 0),
                  LEVEL_BG.length - 1,
                )

                return (
                  <button
                    key={dateKey}
                    type="button"
                    onMouseEnter={() => {
                      setHover(
                        cell ?? {
                          date: dateKey,
                          value: 0,
                          minutes: 0,
                        },
                      )
                    }}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => {
                      setHover(
                        cell ?? {
                          date: dateKey,
                          value: 0,
                          minutes: 0,
                        },
                      )
                    }}
                    onBlur={() => setHover(null)}
                    aria-label={`${dateKey}: ${formatMinutes(minutes)}`}
                    title={`${dateKey} · ${formatMinutes(minutes)}`}
                    className="
                      shrink-0
                      w-[clamp(14px,1.5vw,22px)]
                      h-[clamp(14px,1.5vw,22px)]
                      transition-transform
                      hover:scale-110
                      focus:outline-none
                    "
                    style={{
                      backgroundColor: LEVEL_BG[level],
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
</div>
</section>
  )
}