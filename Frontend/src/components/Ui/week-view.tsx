"use client"

import { format } from "date-fns"
import { useEffect, useMemo, useRef } from "react"
import { cn } from "../../lib/utills"
import {
  DEFAULT_SCROLL_HOUR,
  HOUR_HEIGHT,
  getWeekDays,
  isToday,
  type Task,
} from "../../lib/tasks"
import { TimeGutter } from "./time-gutter"
import { DayTimeColumn } from "./day-time-column"

export function WeekView({
  anchor,
  onSelectTask,
}: {
  anchor: Date
  onSelectTask: (task: Task) => void
}) {
  const days = useMemo(() => getWeekDays(anchor), [anchor])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: HOUR_HEIGHT * DEFAULT_SCROLL_HOUR - 24 })
  }, [anchor])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-soft bg-card">
      {/* Single scroll container so the header row and time grid always
          move together horizontally; the header stays pinned via sticky. */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
        <div className="min-w-[632px]">
          <div className="sticky top-0 z-20 flex border-b border-soft bg-muted/95 backdrop-blur-sm">
            <div className="w-12 shrink-0 border-r border-soft sm:w-16" />
            <div className="grid flex-1 grid-cols-7 bg-canvas">
              {days.map((day) => (
                <div
                  key={day.toISOString()}
                  className="flex flex-col items-center gap-0.5 border-r border-soft px-1 py-2 last:border-r-0"
                >
                  <span className="text-[11px] font-medium uppercase tracking-wide text-secondary font-inter!">
                    {format(day, "EEE")}
                  </span>
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                      isToday(day) ? "bg-primary text-primary-foreground" : "text-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex">
            <TimeGutter />
            <div className="grid flex-1 grid-cols-7">
              {days.map((day) => (
                <DayTimeColumn key={day.toISOString()} date={day} onSelectTask={onSelectTask} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
