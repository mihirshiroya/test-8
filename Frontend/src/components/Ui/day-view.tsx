"use client"

import { format } from "date-fns"
import { useEffect, useMemo, useRef } from "react"
import { CalendarDays } from "lucide-react"
import { cn } from "../../lib/utills"
import { Badge } from "./badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./empty"
import {
  DEFAULT_SCROLL_HOUR,
  HOUR_HEIGHT,
  getTasksForDate,
  isToday,
  useCalendarTasks,
  type Task,
} from "../../lib/tasks"
import { TimeGutter } from "./time-gutter"
import { DayTimeColumn } from "./day-time-column"

export function DayView({
  anchor,
  onSelectTask,
}: {
  anchor: Date
  onSelectTask: (task: Task) => void
}) {
  const allTasks = useCalendarTasks()

  const tasks = useMemo(
    () => getTasksForDate(allTasks, anchor),
    [allTasks, anchor],
  )

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: HOUR_HEIGHT * DEFAULT_SCROLL_HOUR - 24,
    })
  }, [anchor])

  return (
    <div className="calendar-surface flex min-h-0 flex-1 flex-col overflow-hidden border-b border-soft bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-soft bg-muted/40 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
              isToday(anchor)
                ? "bg-primary text-primary-foreground"
                : "text-foreground",
            )}
          >
            {format(anchor, "d")}
          </span>

          <div>
            <p className="text-sm font-semibold text-foreground">
              {format(anchor, "EEEE")}
            </p>

            <p className="text-xs text-muted-foreground">
              {format(anchor, "MMMM yyyy")}
            </p>
          </div>
        </div>

        <Badge variant="secondary" className="shrink-0">
          {tasks.length} {tasks.length === 1 ? "task" : "tasks"} today
        </Badge>
      </div>

      {tasks.length === 0 ? (
        <Empty size="md">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarDays />
            </EmptyMedia>

            <EmptyTitle>Nothing scheduled</EmptyTitle>

            <EmptyDescription>
              Tasks you add for this day will show up here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-auto"
        >
          <div className="flex">
            <TimeGutter />

            <DayTimeColumn
              date={anchor}
              onSelectTask={onSelectTask}
              detailed
              className="flex-1"
            />
          </div>
        </div>
      )}
    </div>
  )
}
