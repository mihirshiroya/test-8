"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { Pause, Timer as TimerIcon, CheckCircle2, X } from "lucide-react"

import {
  useActiveTask,
  useTaskStore,
  formatDuration,
} from "../../store/slices/taskSlice"

import { TimerPanel } from "./timer-panel"

export function TimerWidget() {
  const {
    activeTask: task,
    remainingSeconds: remaining,
    spentSeconds: spent,
  } = useActiveTask()

  const { holdTask, completeTask, workspaces } = useTaskStore()

  const [panelOpen, setPanelOpen] = useState(false)

  /*
   * Prevent portal rendering during SSR.
   */
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  /*
   * No active task.
   */
  if (!task) {
    return (
      <>
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="hidden items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted sm:flex"
          aria-label="Open focus timer"
        >
          <TimerIcon size={16} aria-hidden="true" />

          <span>No active task</span>
        </button>

        {mounted &&
          panelOpen &&
          createPortal(
            <TimerPanelModal onClose={() => setPanelOpen(false)} />,
            document.body,
          )}
      </>
    )
  }

  const workspace = workspaces.find((w) => w.id === task.workspaceId)

  const pct =
    task.plannedDurationSeconds > 0
      ? Math.min(100, Math.round((spent / task.plannedDurationSeconds) * 100))
      : 0

  const isOvertime = remaining <= 0

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Timer Widget                                                        */}
      {/* ------------------------------------------------------------------ */}

      <div
        role="button"
        tabIndex={0}
        onClick={() => setPanelOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            setPanelOpen(true)
          }
        }}
        className="flex cursor-pointer items-center gap-3 rounded-full border border-border bg-card py-1.5 pl-4 pr-1.5 shadow-sm transition-shadow hover:shadow-md"
        aria-label="Open focus timer"
      >
        {/* Task information */}
        <div className="flex min-w-0 flex-col">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {isOvertime ? "Overtime" : workspace?.name ?? "Workspace"}
          </span>

          <span className="hidden max-w-[9rem] truncate text-xs text-foreground sm:block">
            {task.title}
          </span>
        </div>

        {/* Countdown */}
        <span
          className={`shrink-0 font-mono text-xl font-semibold tabular-nums sm:text-2xl ${
            isOvertime ? "text-destructive" : "text-primary"
          }`}
          aria-label={`${formatDuration(remaining)} remaining`}
        >
          {formatDuration(remaining)}
        </span>

        {/* Progress circle */}
        <div
          className="hidden h-9 w-9 shrink-0 place-items-center sm:grid"
          aria-hidden="true"
          style={{
            borderRadius: "9999px",
            background: `conic-gradient(var(--color-primary) ${pct}%, var(--color-muted) 0)`,
          }}
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-card text-[10px] font-semibold tabular-nums text-foreground">
            {pct}%
          </span>
        </div>

        {/* Actions */}
        {/*
         * This is a DIV, not a button.
         *
         * Therefore the Pause and Complete buttons
         * are NOT nested inside another button.
         */}
        <div
          className="flex shrink-0 items-center gap-1"
          onClick={(event) => {
            event.stopPropagation()
          }}
          onKeyDown={(event) => {
            event.stopPropagation()
          }}
        >
          <button
            type="button"
            onClick={() => holdTask(task.id)}
            className="grid h-9 w-9 place-items-center rounded-full text-warning transition-colors hover:bg-warning-soft"
            aria-label="Pause task"
            title="Pause"
          >
            <Pause size={16} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => completeTask(task.id)}
            className="grid h-9 w-9 place-items-center rounded-full text-success transition-colors hover:bg-success-soft"
            aria-label="Complete task"
            title="Complete"
          >
            <CheckCircle2 size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Modal                                                               */}
      {/* ------------------------------------------------------------------ */}

      {mounted &&
        panelOpen &&
        createPortal(
          <TimerPanelModal onClose={() => setPanelOpen(false)} />,
          document.body,
        )}
    </>
  )
}

/* ========================================================================== */
/* Timer Panel Modal                                                          */
/* ========================================================================== */

function TimerPanelModal({ onClose }: { onClose: () => void }) {
  /*
   * Close with Escape.
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    /*
     * Prevent background page scrolling
     * while the modal is open.
     */
    const previousOverflow = document.body.style.overflow

    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", handleKeyDown)

      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Focus Timer"
      onMouseDown={(event) => {
        /*
         * Only close when clicking the backdrop itself.
         */
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      {/* Modal */}
      <div
        className="relative my-auto w-full max-w-xl"
        onMouseDown={(event) => {
          event.stopPropagation()
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-20 grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close focus timer"
          title="Close"
        >
          <X size={17} aria-hidden="true" />
        </button>

        {/* Existing TimerPanel */}
        <TimerPanel />
      </div>
    </div>
  )
}