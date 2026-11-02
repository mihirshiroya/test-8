"use client"

import { useEffect, useState, memo } from "react"
import type { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd"
import {
  Clock3,
  Play,
  Pause,
  Check,
  MoreHorizontal,
  Pencil,
  Trash2,
  CalendarDays,
  Briefcase,
} from "lucide-react"

import {
  useTaskStore,
  isLocked,
  canCompleteTask,
  isTaskStartAllowed,
  normalizeTimestamp,
  taskSpentSeconds,
  PRIORITY_META,
  type Task,
  type TimerState,
} from "../../store/slices/taskSlice"

interface TaskCardProps {
  task: Task
  isActive: boolean
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  showWorkspace?: boolean
  dragHandleProps?: DraggableProvidedDragHandleProps | null
}

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

/**
 * Show only hours + minutes.
 *
 * 3h 25m 42s -> 3h 25m
 * 45m 20s    -> 0h 45m
 * 10h 5m     -> 10h 5m
 */
function formatRemaining(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds))

  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)

  return `${hours}h ${minutes}m`
}

/**
 * The slice's own `remainingSeconds` helper is private to the slice module,
 * so cards compute it the same way locally: planned minus spent.
 */
function computeRemaining(task: Task, timer: TimerState) {
  return Math.max(0, task.plannedDurationSeconds - taskSpentSeconds(task, timer))
}

export const TaskCard = memo(function TaskCard({
  task,
  isActive,
  onEdit,
  onDelete,
  showWorkspace = true,
  dragHandleProps,
}: TaskCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  /**
   * IMPORTANT:
   *
   * Do NOT get `now` from the store here.
   *
   * The task store updates its timer every second, which would cause
   * every TaskCard using the hook to render every second.
   */
  const {
    tasks,
    timer,
    workspaces,
    startTask,
    holdTask,
    completeTask,
  } = useTaskStore()

  /**
   * Local clock, ticked once a second so scheduled-start ("Available at...")
   * cards re-evaluate without needing a per-card timer for inactive cards.
   */
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [])

  /**
   * Only the active task gets its own 1-second remaining-time timer.
   *
   * This means if you have:
   *
   * 100 cards
   *
   * only:
   *
   * 1 card -> updates its remaining time every second
   * 99 cards -> re-derive remaining only when their own data changes
   */
  const [, setRemaining] = useState(() =>
    computeRemaining(task, timer),
  )

  useEffect(() => {
    if (!isActive) {
      setRemaining(computeRemaining(task, timer))
      return
    }

    const updateRemaining = () => {
      setRemaining(computeRemaining(task, timer))
    }

    // Update immediately.
    updateRemaining()

    // Update only this active card every second.
    const intervalId = window.setInterval(updateRemaining, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [
    isActive,
    task.id,
    task.plannedDurationSeconds,
    task.actualDurationSeconds,
    timer.taskId,
    timer.startedAt,
    timer.accumulatedSeconds,
  ])

  const locked = isLocked(task.status)

  const normalizedStartDate = normalizeTimestamp(task.startDate)

  const startsInFuture =
    normalizedStartDate != null && normalizedStartDate > now

  const canComplete = !locked && canCompleteTask(tasks, timer, task.id)

  /**
   * Only allow resuming a task that has already been started.
   */
  const canResume =
    task.startedAt != null &&
    (task.status === "TODO" || task.status === "ON_HOLD")

  /**
   * Only allow starting when:
   * - task isn't locked (completed)
   * - there isn't another active task
   * - scheduled start time has arrived
   */
  const canStart =
    !locked &&
    task.status !== "COMPLETED" &&
    isTaskStartAllowed(tasks, timer, task.id) &&
    !startsInFuture

  const handleStart = () => {
    if (
      locked ||
      task.status === "COMPLETED" ||
      startsInFuture ||
      !isTaskStartAllowed(tasks, timer, task.id)
    ) {
      return
    }

    startTask(task.id)
  }

  const handlePause = () => {
    if (!isActive) {
      return
    }

    holdTask(task.id)
  }

  const handleComplete = () => {
    if (locked) {
      return
    }

    completeTask(task.id)
  }

  const timeSpent = taskSpentSeconds(task, timer)

  const timeSpentLabel = formatRemaining(timeSpent)

  const deadlineLabel = task.deadlineDate
    ? new Date(task.deadlineDate).toLocaleDateString([], {
        month: "short",
        day: "numeric",
      })
    : "No deadline"

  const priorityMeta = PRIORITY_META[task.priority]

  const priorityClass = getPriorityClass(task.priority)

  const startLabel = normalizedStartDate
    ? new Date(normalizedStartDate).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null

  const workspace = workspaces.find((w) => w.id === task.workspaceId)
  const workspaceLabel = workspace?.name ?? "No workspace"

  return (
    <article
      className={[
        "group",
        "bg-[var(--color-background)]",
        "p-3.5",
        "shadow-sm transition-shadow",
        "hover:shadow-(--shadow-card)",
        ""
      ].join(" ")}
    >
      {/* Header */}
      {/* Task content */}
<div
  {...(!startsInFuture ? dragHandleProps : {})}
  className={`flex items-center justify-between gap-3 ${
    startsInFuture
      ? "cursor-not-allowed"
      : "cursor-grab active:cursor-grabbing"
  }`}
>
  {/* Workspace */}
  <div className="flex min-w-0 flex-1 items-center gap-2">
    <Briefcase
      className="size-3 shrink-0 text-secondary"
      aria-hidden="true"
    />

    <span className="truncate text-[10px] font-semibold font-inter! capitalize text-secondary">
      {workspaceLabel}
    </span>
  </div>

  {/* Priority + Actions */}
  <div
    className="relative flex shrink-0 items-center gap-1"
    onPointerDown={(e) => e.stopPropagation()}
  >
    <span
      className={[
        "inline-flex items-center justify-center",
        "shrink-0 px-2 py-1",
        "text-[7px] font-semibold uppercase tracking-wide",
        priorityClass,
      ].join(" ")}
    >
      {priorityMeta.label}
    </span>

    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        setMenuOpen((open) => !open)
      }}
      className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-label="Task actions"
      aria-expanded={menuOpen}
      aria-haspopup="menu"
    >
      <MoreHorizontal className="size-3 rotate-90" />
    </button>

    {menuOpen && (
      <div
        role="menu"
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute right-0 top-full z-50 mt-1 w-40 overflow-hidden border border-soft bg-canvas p-1 shadow-xl"
      >
        <button
          type="button"
          role="menuitem"
          disabled={locked}
          onClick={(e) => {
            e.stopPropagation()
            setMenuOpen(false)
            onEdit(task)
          }}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-secondary transition-colors hover:bg-gray-tint hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Pencil className="size-4" />
          Edit
        </button>

        <button
          type="button"
          role="menuitem"
          onClick={(e) => {
            e.stopPropagation()
            setMenuOpen(false)
            onDelete(task)
          }}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-error transition-colors hover:bg-rose"
        >
          <Trash2 className="size-4" />
          Delete
        </button>
      </div>
    )}
  </div>
</div>

      {/* Task content */}
      {/* Task content */}
<div
  {...(!startsInFuture ? dragHandleProps : {})}
  className={`mt-3 flex items-start justify-between gap-3 ${
    startsInFuture
      ? "cursor-not-allowed"
      : "cursor-grab active:cursor-grabbing"
  }`}
>
  <div className="min-w-0 flex-1">
    <button
      type="button"
      disabled={startsInFuture}
      className={`text-left text-[15px] font-inter! capitalize font-semibold leading-5 transition-colors ${
        startsInFuture
          ? "cursor-not-allowed text-muted-foreground"
          : "cursor-pointer text-foreground hover:text-primary"
      }`}
    >
      {task.title}
    </button>

    {task.description && (
      <p
        className={`mt-1 line-clamp-2 tracking-wide font-semibold text-[13px] leading-4 ${
          startsInFuture
            ? "cursor-not-allowed text-muted-foreground"
            : "cursor-grab text-secondary"
        }`}
      >
        {task.description}
      </p>
    )}
  </div>

  {task.status !== "COMPLETED" && (
    <div
      className="mt-0.5 flex shrink-0 items-center gap-1.5 rounded-full"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Complete */}
      {canComplete && (
        <button
          type="button"
          onClick={handleComplete}
          disabled={locked}
          aria-label="Complete task"
          title="Complete task"
          className="grid size-7 place-items-center rounded-full border border-soft text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Check className="size-4" />
        </button>
      )}

      {/* Start / Pause / Resume */}
      <button
        type="button"
        onClick={isActive ? handlePause : handleStart}
        disabled={isActive ? false : !canStart}
        aria-label={
          isActive ? "Pause task" : canResume ? "Resume task" : "Start task"
        }
        title={
          isActive ? "Pause task" : canResume ? "Resume task" : "Start task"
        }
        className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isActive ? (
          <Pause className="size-3.5" />
        ) : (
          <Play className="size-3.5" />
        )}
      </button>
    </div>
  )}
</div>

      {/* Scheduled start */}
      {startsInFuture && (
        <p className="mt-2 text-[11px] text-warning font-semibold">Available {startLabel}</p>
      )}

      {/* Progress */}
      {task.status !== "COMPLETED" &&
        task.plannedDurationSeconds > 0 &&
        (() => {
          const spent = taskSpentSeconds(task, timer)

          const progress = Math.min(
            100,
            Math.max(
              0,
              Math.floor((spent / task.plannedDurationSeconds) * 10) * 10,
            ),
          )

          const completedSegments = progress / 10

          return (
            <div className="mt-4" aria-label={`${progress}% complete`}>
              <div className="flex w-full gap-1 overflow-hidden">
                {Array.from({ length: 10 }).map((_, index) => (
                  <div
                    key={index}
                    className={`h-2 flex-1 origin-left border-[0.5px] border-soft transition-colors duration-300 ${
                      index < completedSegments ? "bg-primary skew-x-20" : "bg-muted -skew-x-20 "
                    }`}
                  />
                ))}
              </div>
            </div>
          )
        })()}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between pt-2 text-[11px] text-muted-foreground font-inter!">
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="size-3.5" aria-hidden="true" />

          <span className="text-secondary font-semibold">
            {timeSpentLabel}
          </span>
        </span>

        <span className="inline-flex items-center font-inter! gap-1.5 text-secondary font-semibold">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          {deadlineLabel}
        </span>
      </div>
    </article>
  )
})
