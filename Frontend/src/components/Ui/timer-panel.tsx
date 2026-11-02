
"use client"

import { useRef } from "react"

import {
  Play,
  CheckCircle2,
  PauseCircle,Folder,Pause
} from "lucide-react"

import { TimerRobot } from "./timer-robot"
import { TimerDial } from "./timer-dial"

import {
  useActiveTask,
  useTaskStore,
  formatDuration,
  formatClock,
  taskSpentSeconds,
  isTaskStartAllowed,
} from "../../store/slices/taskSlice"

const ROUND_BUTTON_CLASS =
  "grid size-9 cursor-pointer place-items-center rounded-full border border-soft text-[#a3a3a3] transition-colors hover:enabled:bg-[#202020] hover:enabled:text-[#f7f7f5] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f7f7f5] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"

interface TimerPanelProps {
  workspaceId?: string | null
  compact?: boolean
}

export function TimerPanel({
  workspaceId = null,
  compact = false,
}: TimerPanelProps) {
  const {
    tasks,
    timer,
    workspaces,
    startTask,
    holdTask,
    completeTask,
  } = useTaskStore()

  const {
    activeTask: active,
    remainingSeconds: remaining,
    spentSeconds: spent,
  } = useActiveTask()

  const onHoldRef = useRef<HTMLDivElement>(null)

  const hasActiveTask = !!timer.taskId

  const timerText = active
    ? formatClock(Math.max(0, Math.floor(remaining)))
    : "00:00"

  const onHold = tasks
    .filter(
      (task) =>
        task.status === "ON_HOLD" &&
        (!workspaceId || task.workspaceId === workspaceId),
    )
    .sort((a, b) => a.position - b.position)

  const resumableTask = onHold.find((task) =>
    isTaskStartAllowed(tasks, timer, task.id),
  )

  const pct =
    active && active.plannedDurationSeconds > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (spent / active.plannedDurationSeconds) * 100,
          ),
        )
      : 0

  const isFinished = remaining <= 0

  const activeWorkspace = active
    ? workspaces.find((w) => w.id === active.workspaceId)
    : null

  /*
   * ============================
   * COMPACT TIMER
   * ============================
   */
  if (compact) {
    return (
      <span
        className="
          font-mono
          text-sm
          font-medium
          tabular-nums
          tracking-tight
          text-foreground
        "
      >
        {hasActiveTask
          ? formatDuration(Math.max(0, remaining))
          : "00:00"}
      </span>
    )
  }

  return (
    <section
      aria-label="Focus timer"
      className="
        flex
        h-full
        min-h-0
        flex-col
        overflow-y-auto
        bg-canvas
      "
    >
      {/* TIMER CARD */}
      <div className="flex shrink-0 flex-col gap-4 p-4">
        {/* Task / workspace */}


<div className="flex h-10 min-w-0 items-center justify-center gap-2 text-center">
  {active && (
    <>
      <span className="flex min-w-0 max-w-[40%] items-center gap-1">
        <Folder className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span
          className="truncate text-[9px] font-medium !font-inter uppercase tracking-widest text-muted-foreground"
          title={activeWorkspace?.name}
        >
          {activeWorkspace?.name ?? "Workspace"}
        </span>
      </span>

      <span
        aria-hidden="true"
        className="h-3 w-px shrink-0 bg-border"
      />
    </>
  )}

  <span className="flex min-w-0 items-center gap-1">
    {active && (
  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
)}
    <p
      className="truncate text-xs font-medium text-foreground !font-inter"
      title={active?.title}
    >
      {active?.title ?? "No active task"}
    </p>
  </span>
</div>

        {/* Timer face */}
        <div className="flex w-full shrink-0 flex-col items-center gap-4 px-4 pt-5 pb-4 text-primary">
          <TimerDial
            progress={pct}
            finished={!!active && isFinished}
          >
            <TimerRobot size={30} />

            <span
              className={`font-semibold leading-none text-primary ${
                timerText.length > 5
                  ? "text-[30px]"
                  : "text-[42px]"
              }`}
              aria-label={`${timerText} remaining`}
            >
              {timerText}
            </span>

            <div className="flex gap-1.5" aria-hidden="true">
              {[0, 1, 2, 3].map((step) => (
                <span
                  key={step}
                  className={`h-[7px] w-[3px] rounded-[2px] ${
                    active && pct >= step * 25
                      ? "bg-[#ff351b]"
                      : "border border-soft"
                  }`}
                />
              ))}
            </div>

            <span className="text-[9px] leading-3 font-semibold uppercase tracking-[2px] text-[#a3a3a3]">
              {!active
                ? "Standby"
                : timer.phase === "paused"
                  ? "Paused"
                  : isFinished
                    ? "Time's up"
                    : "Focus"}
            </span>
          </TimerDial>

          {/* Timer controls */}
         <div className="flex w-full items-center justify-center gap-3">
 <button
  type="button"
  className={ROUND_BUTTON_CLASS}
  disabled={!active && !resumableTask}
  onClick={() =>
    active
      ? holdTask(active.id)
      : resumableTask && startTask(resumableTask.id)
  }
>
  {active ? (
    <>
      <Pause className="h-3 w-3" />
    
    </>
  ) : resumableTask ? (
    <>
      <Play className="h-3 w-3 fill-current" />
     
    </>
  ) : (
    <Play className="h-3 w-3 fill-current" />
  )}
</button>

  <button
    type="button"
    className={ROUND_BUTTON_CLASS}
    aria-label="Complete task"
    title="Complete task"
    disabled={!active}
    onClick={() => active && completeTask(active.id)}
  >
    <CheckCircle2 size={16} />
  </button>
</div>
        </div>

        {/* Timer statistics */}
       <div className="flex h-4 shrink-0 items-center justify-center gap-4 text-[10px] text-muted-foreground">
  <span
    aria-hidden="true"
    className="h-3 w-3.5 shrink-0 bg-primary"
  />

  <span>
    <strong className="font-mono font-medium text-foreground">
      {formatDuration(active ? spent : 0)}
    </strong>{" "}
    spent
  </span>

  <span
    aria-hidden="true"
    className="h-3 w-3.5 shrink-0 bg-primary"
  />

  <span>
    <strong className="font-mono font-medium text-foreground">
      {formatDuration(active?.plannedDurationSeconds ?? 0)}
    </strong>{" "}
    planned
  </span>
</div>

      </div>

      {/* ON-HOLD TASKS */}
      <div
        ref={onHoldRef}
        className="
          mt-auto
          border-t
          border-soft
          bg-muted/20
          px-3
          py-3
        "
      >
        <div className="mb-2 flex items-center gap-1.5">

          <span className="text-sm font-semibold text-foreground">
            On hold
          </span>

          <span className="text-[10px] text-steel">
            {onHold.length}
          </span>
        </div>

        {onHold.length === 0 ? (
          <p className="text-[10px] text-steel">
            Nothing on hold.
          </p>
        ) : (
          <ul
            className="
              flex
              max-h-28
              flex-col
              gap-1.5
              overflow-y-auto
            "
          >
            {onHold.map((task) => {
              const rem = Math.max(
                0,
                task.plannedDurationSeconds -
                  taskSpentSeconds(task, timer),
              )

              const canResumeNow = isTaskStartAllowed(
                tasks,
                timer,
                task.id,
              )

              return (
                <li
                  key={task.id}
                  className="
                    flex
                    min-w-0
                    items-center
                    gap-2
                    border
                    border-soft
                    bg-card
                    px-2.5
                    py-2
                  "
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {task.title}
                    </p>

                    <p className="text-[9px] !font-inter text-muted-foreground">
                      {formatDuration(rem)} left
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => startTask(task.id)}
                    disabled={
                      hasActiveTask && !canResumeNow
                    }
                    className="
                      flex
                      h-7
                      shrink-0
                      items-center
                      gap-1
                      bg-primary
                      px-2
                      text-[10px]
                      font-medium
                      text-primary-foreground
                      transition-opacity
                      hover:opacity-90
                      disabled:cursor-not-allowed
                      disabled:opacity-40
                    "
                  >
                    <Play size={11} />
                    Resume
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {hasActiveTask && onHold.length > 0 && (
          <p className="mt-2 text-[9px] text-muted-foreground">
            Pause or complete the current task to resume another.
          </p>
        )}
      </div>
    </section>
  )
}
