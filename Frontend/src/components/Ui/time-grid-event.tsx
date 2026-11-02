"use client"

import type { CSSProperties } from "react"
import { Tag } from "lucide-react"
import { cn } from "../../lib/utills"
import {
  getTaskTimeRange,
  useWorkspaceMap,
  type PositionedTask,
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

export function TimeGridEvent({
  task,
  style,
  onSelect,
  detailed = false,
}: {
  task: PositionedTask
  style: CSSProperties
  onSelect: (task: PositionedTask) => void
  detailed?: boolean
}) {
  const { start, end } = getTaskTimeRange(task)

  const priorityClass = getPriorityClass(task.priority)

  // on_hold is treated as muted
  const workspaceName = useWorkspaceMap().get(task.workspaceId)?.name ?? ""

  const isOnHold = task.status === "ON_HOLD"
  const isMuted =
    isOnHold || task.status === "COMPLETED"

  const durationMinutes =
    task.plannedDurationSeconds / 60

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onSelect(task)
      }}
      style={style}
      className={cn(
        "absolute flex flex-col overflow-hidden border-l-[3px] px-1.5 py-1 text-left shadow-sm ring-1 ring-inset ring-border/40 transition-shadow hover:z-10 hover:shadow-md",

        // Priority controls:
        // background + text + left border
        priorityClass,

        isMuted && "opacity-65",

        detailed && "gap-0.5 px-3 py-2",
      )}
    >
      {/* Task title + category */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "truncate text-[11px] font-semibold leading-tight sm:text-xs",
            isOnHold && "line-through",
          )}
        >
          {task.title}
        </span>

        {detailed && (
          <span className="ml-auto flex shrink-0 items-center gap-1 text-[10px] font-medium opacity-90 text-primary">
            <Tag className="size-3" />
            <span className="capitalize">
              {workspaceName}
            </span>
          </span>
        )}
      </div>

      {/* Time */}
      <span className="truncate text-[10px] font-medium opacity-80 sm:text-[11px]">
        {start}
        {(detailed || durationMinutes > 40) &&
          ` – ${end}`}
      </span>
    </button>
  )
}
