import type { Ref } from "react"
import { CheckCircle2, Folder, X } from "lucide-react"

import { Button } from "./button"
import { TimerDial } from "./timer-dial"
import { RobotHead } from "./robot-head"
import { formatDuration, RESPONSE_WINDOW_MS } from "../../store/slices/taskSlice"

interface CheckinCardProps {
  workspaceLabel: string
  taskTitle: string
  spentSeconds: number
  secondsLeft: number
  onContinue: () => void
  onPause: () => void
  primaryRef?: Ref<HTMLButtonElement>
  /** Marks the header as the drag handle of a frameless desktop window. */
  draggable?: boolean
  className?: string
}

/** "Still focusing?" prompt body, shared by the in-app dialog and the desktop overlay window. */
export function CheckinCard({
  workspaceLabel,
  taskTitle,
  spentSeconds,
  secondsLeft,
  onContinue,
  onPause,
  primaryRef,
  draggable = false,
  className = "",
}: CheckinCardProps) {
  const windowSeconds = RESPONSE_WINDOW_MS / 1000
  const progress = Math.min(100, (secondsLeft / windowSeconds) * 100)
  const countdownText = `00:${String(secondsLeft).padStart(2, "0")}`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkin-title"
      aria-describedby="checkin-desc"
      className={`relative w-full border border-soft bg-canvas p-6 shadow-2xl ${className}`}
    >
      <div
        className="mb-5 flex items-start justify-between gap-4"
        {...(draggable ? { "data-tauri-drag-region": true } : {})}
      >
        <div className="min-w-0" {...(draggable ? { "data-tauri-drag-region": true } : {})}>
          <h2 id="checkin-title" className="text-lg font-semibold text-ink font-inter!">
            Still focusing?
          </h2>

          <p id="checkin-desc" className="mt-1 text-sm text-steel">
            {"If you don't respond, this task will be moved to On Hold automatically."}
          </p>
        </div>

        <button
          type="button"
          onClick={onContinue}
          aria-label="Close and continue"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-steel hover:bg-gray-tint hover:text-ink"
        >
          <X className="size-[18px]" />
        </button>
      </div>

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
          <p className="truncate text-xs font-medium text-foreground font-inter!" title={taskTitle}>
            {taskTitle}
          </p>
        </span>
      </div>

      <div className="flex flex-col items-center gap-4 pt-6 pb-2 text-primary">
        <div className="w-full max-w-48" role="timer" aria-live="off">
          <TimerDial progress={progress} finished={secondsLeft === 0}>
            <RobotHead state="listening" size={26} color="currentColor" className="shrink-0" />

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
            <strong className="font-mono font-medium text-foreground">{formatDuration(spentSeconds)}</strong>{" "}
            spent so far
          </span>
        </div>
      </div>

      <div className="mt-7 flex justify-end gap-2">
        <Button size="lg" onClick={onPause} className="bg-background border border-soft font-inter! text-steel">
          Pause it
        </Button>

        <Button
          ref={primaryRef}
          size="lg"
          onClick={onContinue}
          className="bg-primary text-on-primary hover:bg-primary-pressed font-inter!"
        >
          Yes, continue
        </Button>
      </div>
    </div>
  )
}
