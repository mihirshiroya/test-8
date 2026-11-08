import {
  BookOpenCheck,
  CircleDashed,
  CircleCheck,
} from "lucide-react"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./empty"
import { useTodayTasks } from "../../store/slices/taskSlice"
import { ThemedSvg } from "../../lib/svg-theme"
import getStartedRaw from "../../assets/01-streak-flame.svg?raw"

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

function getDaysLeftText(deadlineDate: number | null) {
  if (deadlineDate == null) return null

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

  const target = new Date(deadlineDate)
  const deadlineDay = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime()

  const diffDays = Math.round((deadlineDay - today) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    const days = Math.abs(diffDays)
    return { text: `${days} ${days === 1 ? "day" : "days"} overdue`, isOverdue: true }
  }

  if (diffDays === 0) {
    return { text: "Due today", isOverdue: false }
  }

  if (diffDays === 1) {
    return { text: "1 day left", isOverdue: false }
  }

  return { text: `${diffDays} days left`, isOverdue: false }
}

export function TodaysTasks() {
  const tasks = useTodayTasks()

  const completedCount = tasks.filter(
    (task) => task.status === "COMPLETED" || task.completedAt != null,
  ).length

  const pct =
    tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0

  return (
    // Fixed container height
    <div className="workspace-panel relative flex h-[360px] w-full flex-col overflow-hidden">
      {/* Header */}
      <div className="relative z-10 flex shrink-0 items-center justify-between">
        <div className="min-w-0">
          <h3 className="text-heading-5 text-primary">Today&apos;s tasks</h3>

          <p className="mt-1 text-body-sm text-steel !font-semibold !font-inter">
            {tasks.length === 0
              ? "No tasks scheduled"
              : `${completedCount} of ${tasks.length} complete`}
          </p>
        </div>

        <BookOpenCheck className="size-5 shrink-0 text-steel" aria-hidden="true" />
      </div>

      {/* Progress */}
      {tasks.length > 0 && (
        <div className="relative z-10 mt-4 h-1.5 w-full shrink-0 overflow-hidden rounded-notion-full bg-surface">
          <div
            className="h-full rounded-notion-full bg-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* Empty state */}
      {tasks.length === 0 ? (
        <Empty size="md" className="relative z-10 my-auto border-0 p-0">
          <EmptyHeader>
            {/* Themed illustration replaces the icon */}
            <EmptyMedia variant="illustration">
              <ThemedSvg raw={getStartedRaw} ariaLabel="No tasks illustration" />
            </EmptyMedia>

            <EmptyTitle>No tasks for today</EmptyTitle>

            <EmptyDescription className="text-steel">
              You don&apos;t have any tasks scheduled for today.
            </EmptyDescription>
          </EmptyHeader>

          <EmptyContent />
        </Empty>
      ) : (
        /* Scrollable Task List Area */
        <div className="relative z-10 mt-4 min-h-0 flex-1 overflow-y-auto pr-1 no-scrollbar">
          <div className="flex flex-col gap-4">
            {tasks.map((task) => {
              const done = task.status === "COMPLETED" || task.completedAt != null

              const deadlineInfo = getDaysLeftText(task.deadlineDate)

              return (
                <div key={task.id} className="flex flex-col gap-1">
                  {/* Top Row: Name and Priority */}
                  <div className="flex items-center justify-between gap-3 min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="shrink-0">
                        {done ? (
                          <CircleCheck className="h-5 w-5 text-success" />
                        ) : (
                          <CircleDashed className="h-5 w-5 text-secondary" />
                        )}
                      </div>

                      <span
                        className={`truncate text-body-md-medium ${
                          done ? "text-stone line-through" : "text-primary"
                        }`}
                      >
                        {task.title}
                      </span>
                    </div>

                    <span
                      className={`shrink-0 whitespace-nowrap px-2 py-0.5 text-xs ${getPriorityClass(
                        task.priority,
                      )}`}
                    >
                      {task.priority || "Normal"}
                    </span>
                  </div>

                  {/* Bottom Row: Days Left Till Deadline */}
                  {deadlineInfo && (
                    <div className="flex items-center gap-1.5 pl-7 text-caption">
                      <span
                        className={`font-medium ${
                          deadlineInfo.isOverdue
                            ? "text-red-600 dark:text-red-400"
                            : "text-stone"
                        }`}
                      >
                        {deadlineInfo.text}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
