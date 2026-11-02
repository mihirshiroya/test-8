"use client"

import { addDays, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns"
import { useMemo } from "react"
import { getTasksForDate, useCalendarTasks, type Task } from "../../lib/tasks"
import { DayCell } from "./day-cell"

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export function MonthGrid({
  monthAnchor,
  onSelectTask,
  onMore,
}: {
  monthAnchor: Date
  onSelectTask: (task: Task) => void
  onMore: (date: Date, tasks: Task[]) => void
}) {
  const allTasks = useCalendarTasks()

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthAnchor), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(monthAnchor), { weekStartsOn: 1 })
    const result: Date[] = []
    let cursor = start
    while (cursor <= end) {
      result.push(cursor)
      cursor = addDays(cursor, 1)
    }
    return result
  }, [monthAnchor])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-soft bg-card">
      <div className="grid grid-cols-7 border-b border-soft bg-canvas">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-2 font-inter! text-center text-sm font-bold text-muted-foreground sm:text-left sm:px-3"
          >
            <span className="sm:hidden">{label[0]}</span>
            <span className="hidden sm:inline">{label}</span>
          </div>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7 grid-rows-6 overflow-y-auto">
        {days.map((day) => (
          <DayCell
            key={day.toISOString()}
            date={day}
            monthAnchor={monthAnchor}
            tasks={getTasksForDate(allTasks, day)}
            onSelectTask={onSelectTask}
            onMore={onMore}
          />
        ))}
      </div>
    </div>
  )
}