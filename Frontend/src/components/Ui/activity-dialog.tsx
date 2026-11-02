"use client"

import { useEffect, useRef } from "react"
import { CheckCircle2, Folder, X } from "lucide-react"

import { Button } from "./button"
import { TimerDial } from "./timer-dial"
import { TimerRobot } from "./timer-robot"
import {
  useTaskStore,
  formatDuration,
  taskSpentSeconds,
  RESPONSE_WINDOW_MS,
} from "../../store/slices/taskSlice"

/**
 * NOTE ON MIGRATION:
 *
 * The old TimerState had a dedicated "checking" phase with a hard
 * `checkDeadline` timestamp, which powered the circular countdown you'd
 * see here. The new TimerState doesn't track a check-in deadline at all —
 * `timerTick` just flips `isStale` to true if too much time passed since
 * the timer was last confirmed as running (e.g. the tab was backgrounded
 * or the machine slept). Because there's no deadline to count down to
 * anymore, this dialog now shows as soon as the timer goes stale, with no
 * countdown — the person can confirm they're still working or pause.
 */
export function ActivityDialog() {
  const { timer, tasks, workspaces, confirmActive, holdTask } = useTaskStore()

  const primaryRef = useRef<HTMLButtonElement>(null)

  const open = timer.phase === "running" && timer.isStale && !!timer.taskId

  const task = tasks.find((t) => t.id === timer.taskId)

  useEffect(() => {
    if (open) {
      primaryRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open || !task) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        confirmActive(task.id)
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [open, task, confirmActive])

  if (!open || !task) {
    return null
  }

  const workspace = workspaces.find((w) => w.id === task.workspaceId)
  const workspaceLabel = workspace?.name ?? "Workspace"

  const spent = taskSpentSeconds(task, timer)

  const secondsLeft = Math.max(
    0,
    Math.ceil(((timer.checkDeadline ?? Date.now()) - (timer.now || Date.now())) / 1000)
  )
  const windowSeconds = RESPONSE_WINDOW_MS / 1000
  const progress = Math.min(100, (secondsLeft / windowSeconds) * 100)
  const countdownText = `00:${String(secondsLeft).padStart(2, "0")}`

  const dismiss = () => confirmActive(task.id)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        tabIndex={-1}
        onClick={dismiss}
        className="absolute inset-0 bg-background/80 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkin-title"
        aria-describedby="checkin-desc"
        className="relative w-full max-w-md border border-soft bg-canvas p-6 shadow-2xl"
      >
        {/* HEADER */}

        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2
              id="checkin-title"
              className="text-lg font-semibold text-ink font-inter!"
            >
              Still focusing?
            </h2>

            <p id="checkin-desc" className="mt-1 text-sm text-steel">
              {"If you don't respond, this task will be moved to On Hold automatically."}
            </p>
          </div>

          <button
            type="button"
            onClick={dismiss}
            aria-label="Close and continue"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-steel hover:bg-gray-tint hover:text-ink"
          >
            <X className="size-[18px]" />
          </button>
        </div>

        {/* TASK */}

        <div className="flex h-10 min-w-0 items-center justify-center gap-2 bg-background px-3 text-center">
          <span className="flex min-w-0 max-w-[40%] items-center gap-1">
            <Folder className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span
              className="truncate text-[9px] font-medium font-inter! uppercase tracking-widest text-muted-foreground"
              title={workspaceLabel}
            >
              {workspaceLabel}
            </span>
          </span>

          <span aria-hidden="true" className="h-3 w-px shrink-0 bg-border" />

          <span className="flex min-w-0 items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p
              className="truncate text-xs font-medium text-foreground font-inter!"
              title={task.title}
            >
              {task.title}
            </p>
          </span>
        </div>

        {/* TIMER */}

        <div className="flex flex-col items-center gap-4 pt-6 pb-2 text-primary">
          <div className="w-full max-w-48" role="timer" aria-live="off">
            <TimerDial progress={progress} finished={secondsLeft === 0}>
              <TimerRobot size={26} />

              <span
                className="text-[36px] font-semibold leading-none text-primary tabular-nums"
                aria-label={`${secondsLeft} seconds until auto-pause`}
              >
                {countdownText}
              </span>

              <span className="text-[9px] leading-3 font-semibold uppercase tracking-[2px] text-[#a3a3a3]">
                Auto-pause
              </span>
            </TimerDial>
          </div>

          <div className="flex h-4 items-center justify-center gap-2 text-[10px] text-muted-foreground">
            <span aria-hidden="true" className="h-3 w-3.5 shrink-0 bg-primary" />
            <span>
              <strong className="font-mono font-medium text-foreground">
                {formatDuration(spent)}
              </strong>{" "}
              spent so far
            </span>
          </div>
        </div>

        {/* FOOTER */}

        <div className="mt-7 flex justify-end gap-2">
          <Button
            size="lg"
            onClick={() => holdTask(task.id)}
            className="bg-background border border-soft font-inter! text-steel"
          >
            Pause it
          </Button>

          <Button
            ref={primaryRef}
            size="lg"
            onClick={dismiss}
            className="bg-primary text-on-primary hover:bg-primary-pressed font-inter!"
          >
            Yes, continue
          </Button>
        </div>
      </div>
    </div>
  )
}
