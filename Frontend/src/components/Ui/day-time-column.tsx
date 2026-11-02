"use client"

import { useMemo } from "react"
import {
  GRID_END_HOUR,
  GRID_START_HOUR,
  HOUR_HEIGHT,
  getTaskHeight,
  getTaskTopOffset,
  getTasksForDate,
  isToday,
  layoutTasksForDay,
  useCalendarTasks,
  type PositionedTask,
  type Task,
} from "../../lib/tasks"
import { cn } from "../../lib/utills"
import { TimeGridEvent } from "./time-grid-event"
import { CurrentTimeIndicator } from "./current-time-indicator"

export function DayTimeColumn({
  date,
  onSelectTask,
  detailed = false,
  className,
}: {
  date: Date
  onSelectTask: (task: Task) => void
  detailed?: boolean
  className?: string
}) {
  const allTasks = useCalendarTasks()
  const positioned = useMemo(
    () => layoutTasksForDay(getTasksForDate(allTasks, date)),
    [allTasks, date]
  )
  const hourCount = GRID_END_HOUR - GRID_START_HOUR
  const today = isToday(date)

  return (
    <div
      className={cn("relative border-r border-soft last:border-r-0", className)}
      style={{ height: HOUR_HEIGHT * hourCount }}
    >
      {Array.from({ length: hourCount }).map((_, h) => (
        <div key={h} className="border-b border-soft" style={{ height: HOUR_HEIGHT }} />
      ))}
{positioned.map((task) => {
  const gap = 3

  const columnCount = Math.max(task.columnCount ?? 1, 1)
  const column = task.column ?? 0

  const columnWidth = 100 / columnCount

  return (
    <TimeGridEvent
      key={task.id}
      task={task as PositionedTask}
      detailed={detailed}
      onSelect={onSelectTask}
      style={{
        top: getTaskTopOffset(task) + 2,
        height: Math.max(getTaskHeight(task) - 4, 20),

        left: `calc(${column * columnWidth}% + ${gap}px)`,

        width: `calc(${columnWidth}% - ${gap * 2}px)`,
      }}
    />
  )
})}

      {today && <CurrentTimeIndicator />}
    </div>
  )
}