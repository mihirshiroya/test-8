"use client"

import { format, isSameMonth, isToday } from "date-fns"
import { cn } from "../../lib/utills"
import type { Task } from "../../lib/tasks"
import { TaskChip } from "./task-chip"

const MAX_VISIBLE = 3

export function DayCell({
  date,
  monthAnchor,
  tasks,
  onSelectTask,
  onMore,
}: {
  date: Date
  monthAnchor: Date
  tasks: Task[]
  onSelectTask: (task: Task) => void
  onMore: (date: Date, tasks: Task[]) => void
}) {
  const inMonth = isSameMonth(date, monthAnchor)
  const today = isToday(date)
  const visible = tasks.slice(0, MAX_VISIBLE)
  const overflow = tasks.length - visible.length

  return (
    <div
      className={cn(
        "group relative flex min-h-28 flex-col gap-1 border-b border-r border-soft p-1.5 transition-colors sm:min-h-32 sm:p-2",
        !inMonth && "bg-muted/30",
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full text-xs font-medium font-inter!",
            today
              ? "bg-primary text-primary-foreground"
              : inMonth
                ? "text-foreground"
                : "text-slate-600/60",
          )}
        >
          {format(date, "d")}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-hidden">
        {visible.map((task) => (
          <TaskChip key={task.id} task={task} onSelect={onSelectTask} />
        ))}
        {overflow > 0 && (
          <button
            type="button"
            onClick={() => onMore(date, tasks)}
            className="truncate px-1.5 py-0.5 text-left text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            {overflow} more…
          </button>
        )}
      </div>
    </div>
  )
}
