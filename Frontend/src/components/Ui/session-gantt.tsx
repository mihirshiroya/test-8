import {
  type SessionRecord,
  durationSeconds,
  formatCompact,
} from "../../lib/time"
import { ThemedSvg } from "../../lib/svg-theme"
import noResultsRaw from "../../assets/31-no-results.svg?raw"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "./empty"

interface SessionGanttProps {
  sessions: SessionRecord[]
  /** Map of task name -> chart color css var, e.g. "var(--chart-1)". */
  colors: Record<string, string>
}

const HOUR = 60 * 60 * 1000

const TASK_COLUMN_WIDTH = 152
const HOUR_WIDTH = 110
const ROW_HEIGHT = 36 // h-9
const ROW_GAP = 10 // gap-2.5
const AXIS_HEIGHT = 32 // h-8

/**
 * Gantt chart
 *
 * Layout strategy (important):
 * This is NOT built with `position: sticky` over a shared scroll
 * container. Sticky + z-index overlay approaches are fragile —
 * they depend on stacking-context details that can silently break
 * depending on what's rendered around this component, in ways that
 * are hard to fully guarantee.
 *
 * Instead the task-name column and the scrollable timeline are two
 * *physically separate* elements placed side by side:
 *   - the name column is normal, non-scrolling content
 *   - the timeline lives in its own `overflow-x-auto` box
 * Because they are different DOM subtrees, the timeline can never
 * visually render "through" or "over" the name column — there is no
 * shared paint/stacking surface for it to leak into. Row heights and
 * gaps are kept in the constants above so the two columns line up.
 */
export function SessionGantt({
  sessions,
  colors,
}: SessionGanttProps) {
  if (!sessions.length) {
    return (
      <Empty size="md">
        <EmptyHeader>
          <EmptyMedia variant="illustration">
            <ThemedSvg raw={noResultsRaw} ariaLabel="No sessions" />
          </EmptyMedia>
          <EmptyTitle>No sessions to display</EmptyTitle>
          <EmptyDescription className="text-steel">Start a focus session to see it on your timeline.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent />
      </Empty>
    )
  }

  // ------------------------------------------------------------
  // Calculate time range
  // ------------------------------------------------------------

  const starts = sessions.map((session) =>
    new Date(session.start).getTime()
  )

  const ends = sessions.map((session) =>
    new Date(session.end).getTime()
  )

  const rawMin = Math.min(...starts)
  const rawMax = Math.max(...ends)

  const min = Math.floor(rawMin / HOUR) * HOUR

  const max =
    rawMax === rawMin
      ? min + HOUR
      : Math.ceil(rawMax / HOUR) * HOUR

  const span = Math.max(max - min, HOUR)

  // Number of hours displayed.
  const hours = Math.max(1, Math.ceil(span / HOUR))

  // Fixed width for every hour.
  // This prevents the timeline from becoming compressed.
  const timelineWidth = Math.max(
    hours * HOUR_WIDTH,
    700
  )

  // ------------------------------------------------------------
  // Hour ticks
  // ------------------------------------------------------------

  const ticks: number[] = []

  for (let timestamp = min; timestamp <= max; timestamp += HOUR) {
    ticks.push(timestamp)
  }

  // ------------------------------------------------------------
  // Group sessions by task
  // ------------------------------------------------------------

  const taskNames: string[] = []

  for (const session of sessions) {
    if (!taskNames.includes(session.taskName)) {
      taskNames.push(session.taskName)
    }
  }

  // ------------------------------------------------------------
  // Timeline positioning
  // ------------------------------------------------------------

  const getPosition = (timestamp: number) => {
    return ((timestamp - min) / span) * timelineWidth
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }

  return (
    <div className="w-full min-w-0 flex">
      {/* ======================================================
          FIXED TASK NAME COLUMN (never scrolls, never overlapped)
          ====================================================== */}

      <div
        className="
          relative
          z-10
          flex
          shrink-0
          flex-col
          bg-background
          shadow-[6px_0_10px_-10px_rgba(0,0,0,0.5)]
          after:absolute
          after:right-0
          after:top-0
          after:h-full
          after:w-px
          after:bg-border
        "
        style={{ width: `${TASK_COLUMN_WIDTH}px` }}
      >
        {/* Spacer matching the axis row height in the scrollable side */}
        <div
          className="shrink-0"
          style={{ height: `${AXIS_HEIGHT}px` }}
          aria-hidden="true"
        />

        <div
          className="flex flex-col"
          style={{ gap: `${ROW_GAP}px` }}
        >
          {taskNames.map((name) => {
            const color = colors[name] ?? "var(--color-primary)"

            return (
              <div
                key={name}
                className="flex shrink-0 items-center gap-2 overflow-hidden pr-3"
                style={{ height: `${ROW_HEIGHT}px` }}
              >
                {/* Task color */}
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />

                {/* Task title */}
                <span
                  className="min-w-0 truncate text-sm capitalize tracking-wide font-medium text-foreground"
                  title={name}
                >
                  {name}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ======================================================
          SCROLLABLE TIMELINE (axis, gridlines, bars)
          Physically separate box — its own scroll container,
          nothing here ever draws into the column above.
          ====================================================== */}

      <div
        className="
          min-w-0
          flex-1
          overflow-x-auto
          overflow-y-hidden
          overscroll-x-contain
          no-scrollbar
        "
      >
        <div
          className="relative"
          style={{ width: `${timelineWidth}px` }}
        >
          {/* ================================================
              TIME AXIS
              ================================================ */}

          <div
            className="relative shrink-0"
            style={{ height: `${AXIS_HEIGHT}px` }}
          >
            {ticks.map((timestamp) => {
              const left = getPosition(timestamp)

              return (
                <div
                  key={timestamp}
                  className="
                    absolute
                    top-0
                    -translate-x-1/2
                    whitespace-nowrap
                    font-mono
                    text-[10px]
                    tabular-nums
                    text-steel font-inter! font-semibold
                  "
                  style={{ left: `${left}px` }}
                >
                  {formatTime(timestamp)}
                </div>
              )
            })}
          </div>

          {/* ================================================
              TASK LANES
              ================================================ */}

          <div
            className="flex flex-col"
            style={{ gap: `${ROW_GAP}px` }}
          >
            {taskNames.map((name) => {
              const laneSessions = sessions.filter(
                (session) => session.taskName === name
              )

              const color = colors[name] ?? "var(--color-primary)"

              return (
                <div
                  key={name}
                  className="relative shrink-0 overflow-hidden no-scrollbar bg-secondary/40"
                  style={{
                    height: `${ROW_HEIGHT}px`,
                    width: `${timelineWidth}px`,
                  }}
                >
                  {/* ------------------------------------------
                      HOUR GRIDLINES
                      ------------------------------------------ */}

                  {ticks.map((timestamp) => {
                    const left = getPosition(timestamp)

                    return (
                      <div
                        key={timestamp}
                        className="pointer-events-none absolute inset-y-0 w-px bg-gray-500/20 no-scrollbar"
                        style={{ left: `${left}px` }}
                        aria-hidden="true"
                      />
                    )
                  })}

                  {/* ------------------------------------------
                      SESSION BARS
                      ------------------------------------------ */}

                  {laneSessions.map((session) => {
                    const start = new Date(session.start).getTime()
                    const end = new Date(session.end).getTime()

                    const left = getPosition(start)
                    const right = getPosition(end)

                    const width = Math.max(right - left, 4)

                    return (
                      <div
                        key={session.id}
                        className="
                          group
                          absolute
                          top-1/2
                          flex
                          h-5
                          -translate-y-1/2
                          items-center
                          justify-center
                          overflow-hidden
      
                          px-1.5
                          transition-[filter,box-shadow]
                          hover:z-10
                          hover:brightness-105
                          hover:shadow-sm
                        "
                        style={{
                          left: `${left}px`,
                          width: `${width}px`,
                          backgroundColor: color,
                        }}
                        title={`${name} — ${formatCompact(
                          durationSeconds(session)
                        )}`}
                      >
                        <span
                          className="
                            truncate
                            whitespace-nowrap
                            font-mono
                            text-[10px]
                            font-bold
                            tabular-nums
                            text-primary
                          "
                        >
                          {formatCompact(durationSeconds(session))}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
