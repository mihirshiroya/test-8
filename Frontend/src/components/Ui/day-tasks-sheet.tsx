"use client"

import { format } from "date-fns"
import {
  CalendarDays,
  Tag,
  CircleDot,
} from "lucide-react"
import { cn } from "../../lib/utills"
import {
  getWorkspaceVisual,
  getPriorityVisual,
  useWorkspaceMap,
  STATUS_CONFIG,
  type Task,
} from "../../lib/tasks"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "./sheet"

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

export function DayTasksSheet({
  date,
  tasks,
  open,
  onOpenChange,
  onSelectTask,
}: {
  date: Date | null
  tasks: Task[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectTask: (task: Task) => void
}) {
  // Hooks must run before the early return below (rules of hooks).
  const workspaceMap = useWorkspaceMap()

  if (!date) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full bg-canvas sm:max-w-sm"
      >
        <SheetHeader className="border-b border-soft pb-3">
          <SheetTitle className="text-lg font-bold">
            {format(date, "EEEE, MMMM d")}
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-y-4 overflow-y-auto py-3">
          {tasks.map((task) => {
            const workspace = getWorkspaceVisual(workspaceMap.get(task.workspaceId))
            const priorityClass = getPriorityClass(task.priority)
            const priorityLabel = getPriorityVisual(task.priority).label
            const statusLabel = STATUS_CONFIG[task.status].label

            const isDone = task.status === "COMPLETED"
            const isOnHold = task.status === "ON_HOLD"

            return (
              <button
                key={task.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectTask(task)
                }}
                className={cn(
                  "w-full text-left transition-colors border border-soft py-2",
                  "hover:bg-muted/50",
                  isDone && "opacity-60",
                  isOnHold && "opacity-60",
                )}
              >
                {/* Title + Priority */}
                <div className="flex justify-between">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      style={workspace.dotStyle}
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        isOnHold && "opacity-60",
                      )}
                    />

                    <span
                      className={cn(
                        "truncate text-md font-bold",
                        isOnHold && "line-through",
                      )}
                    >
                      {task.title}
                    </span>
                  </div>

                  {/* Priority */}
                  <span
                    className={cn(
                      "mr-2 flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
                      priorityClass,
                    )}
                  >
                    {priorityLabel}
                  </span>
                </div>

                {/* Metadata */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5 px-3">
                  {/* Deadline */}
                  {task.deadlineDate && (
                    <span className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      <CalendarDays className="size-3" />

                      {format(
                        new Date(task.deadlineDate),
                        "MMM d, yyyy",
                      )}
                    </span>
                  )}

                  {/* Workspace */}
                  <span
                    style={workspace.chipStyle}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]"
                  >
                    <Tag className="size-3" />

                    <span className="text-secondary">
                      {workspace.label}
                    </span>
                  </span>

                  {/* Status */}
                  <span
                    className={cn(
                      "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]",
                      task.status === "COMPLETED" &&
                        " text-green-600 ",
                      task.status === "IN_PROGRESS" &&
                        "text-blue-600",
                      task.status === "TODO" &&
                        "bg-muted text-muted-foreground",
                      task.status === "ON_HOLD" &&
                        " text-orange-600",
                    )}
                  >
                    <CircleDot className="size-3" />

                    <span className="text-secondary">
                      {statusLabel}
                    </span>
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </SheetContent>
    </Sheet>
  )
}