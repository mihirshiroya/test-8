"use client"

import { eachDayOfInterval, endOfMonth, format, isSameMonth, startOfMonth } from "date-fns"
import { useMemo } from "react"
import {
  getTasksForDate,
  getTaskTimeRange,
  getWorkspaceVisual,
  isToday,
  useCalendarTasks,
  useWorkspaceMap,
  type Task,
} from "../../lib/tasks"
import { cn } from "../../lib/utills"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "./empty"
import { CalendarDays } from "lucide-react"

export function MobileAgenda({
  monthAnchor,
  onSelectTask,
}: {
  monthAnchor: Date
  onSelectTask: (task: Task) => void
}) {
  const allTasks = useCalendarTasks()
  // Tasks only carry workspaceId, so resolve names/colours via one shared lookup.
  const workspaceMap = useWorkspaceMap()

  const days = useMemo(() => {
    const start = startOfMonth(monthAnchor)
    const end = endOfMonth(monthAnchor)
    return eachDayOfInterval({ start, end }).filter((day) => isSameMonth(day, monthAnchor))
  }, [monthAnchor])

  const daysWithTasks = useMemo(
    () =>
      days
        .map((day) => ({ day, tasks: getTasksForDate(allTasks, day) }))
        .filter((d) => d.tasks.length > 0),
    [days, allTasks]
  )

  if (daysWithTasks.length === 0) {
    return (
      <Empty size="md">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarDays />
          </EmptyMedia>
          <EmptyTitle>No tasks this month</EmptyTitle>
          <EmptyDescription>Tasks you add will show up here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto border border-soft">
      {daysWithTasks.map(({ day, tasks }) => (
        <div key={day.toISOString()} className="flex flex-col">
          <div className="flex items-center gap-2 px-2 py-2 bg-canvas font-inter!">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                isToday(day) ? "bg-primary text-primary-foreground" : "text-foreground"
              )}
            >
              {format(day, "d")}.
            </span>
            <span className="text-sm font-semibold text-foreground">{format(day, "EEEE")}</span>
           
          </div>
          <div className="flex flex-col gap-1.5 bg-background">
            {tasks.map((task) => {
              const range = getTaskTimeRange(task)
              const workspace = getWorkspaceVisual(workspaceMap.get(task.workspaceId))
              // No "canceled" status in the store — ON_HOLD is the closest
              // equivalent (task exists but isn't actively progressing).
              const isOnHold = task.status === "ON_HOLD"
              const isDone = task.status === "COMPLETED"
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onSelectTask(task)}
                  className={cn(
                    "flex items-center gap-3  border border-soft bg-background px-3 py-2.5 text-left transition-colors active:bg-muted",
                    (isOnHold || isDone) && "opacity-70"
                  )}
                >
                  <span
                    className="size-2 shrink-0"
                    style={workspace.dotStyle}
                    aria-hidden="true"
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span
                      className={cn(
                        "truncate text-sm font-medium text-foreground font-inter!",
                        isOnHold && "line-through"
                      )}
                    >
                      {task.title}
                    </span>
                    <span className="text-xs text-muted-foreground">{workspace.label}</span>
                  </div>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">{range.start}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
