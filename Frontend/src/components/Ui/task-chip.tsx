"use client"

import { cn } from "../../lib/utills"
import {
  getWorkspaceVisual,
  getTaskTimeRange,
  useCalendarWorkspaces,
  type Task,
} from "../../lib/tasks"

function getPriorityClass(priority: string | undefined) {
  switch (priority?.toLowerCase()) {
    case "urgent":
      return "badge-priority-urgent"

    case "high":
      return "badge-priority-high"

    case "medium":
      return "badge-priority-medium"

    case "low":
      return "badge-priority-low"

    default:
      return "badge-priority-default"
  }
}

export function TaskChip({
  task,
  onSelect,
}: {
  task: Task
  onSelect: (task: Task) => void
}) {
  // Resolve the task's workspace from the store (tasks only carry workspaceId).
  const workspaces = useCalendarWorkspaces()
  const workspace = workspaces.find((w) => w.id === task.workspaceId)
  const visual = getWorkspaceVisual(workspace)

  const isDone = task.status === "COMPLETED"
  const isOnHold = task.status === "ON_HOLD"

  const { start } = getTaskTimeRange(task)

  const priorityClass = getPriorityClass(task.priority)

  return (
    <button
      type="button"
      title={`${task.title} · ${visual.label}`}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(task)
      }}
      // Workspace colour (inline: Tailwind can't generate interpolated classes)
      style={visual.chipStyle}
      className={cn(
        "group flex w-full items-center gap-1.5 px-1.5 py-1 text-left text-[11px] leading-tight transition-colors",

        // Priority styling applied to the whole chip
        priorityClass,

        // Status styling
        isDone && "opacity-60",
        isOnHold && "opacity-50",
      )}
    >
      {/* Task title */}
      <span
        className={cn(
          "min-w-0 truncate font-medium",
          isOnHold && "line-through",
        )}
      >
        {task.title}
      </span>

      {/* Start time */}
      <span className="ml-auto hidden shrink-0 font-mono text-[10px] opacity-70 sm:inline">
        {start}
      </span>
    </button>
  )
}