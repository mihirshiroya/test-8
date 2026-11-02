import type { CSSProperties } from "react"
import { useMemo } from "react"
import {
  addDays,
  addSeconds,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfWeek,
} from "date-fns"
import { useSelector } from "react-redux"

// ---------------------------------------------------------------------------
// Calendar view, reading tasks and workspaces straight from the Redux store.
//
// The store's `Task` shape (taskSlice.ts) is the single source of truth.
// This file only adds calendar-specific presentation helpers on top of it
// (day bucketing, time-grid layout, formatting).
//
// Key schema differences this file bridges:
//   - date + startTime (strings)      -> startDate (epoch ms, nullable)
//   - durationMinutes                 -> plannedDurationSeconds
//   - category (string)               -> workspaceId (FK to Workspace)
//   - status: upcoming/in-progress/…  -> TODO / IN_PROGRESS / ON_HOLD / COMPLETED
//   - priority: low/medium/high       -> LOW / MEDIUM / HIGH / URGENT
// ---------------------------------------------------------------------------

import type { Task, TaskPriority, TaskStatus, Workspace } from "../store/slices/taskSlice"

import {
  normalizeTimestamp,
  selectTasks,
  selectWorkspaces,
  PRIORITY_META,
  STATUS_META,
} from "../store/slices/taskSlice"

export type CalendarViewMode = "month" | "week" | "day"

// Re-exported so calendar components can keep importing these types
// from the calendar-utils module rather than reaching into the store.
export type { Task, TaskPriority, TaskStatus, Workspace }

/* -------------------------------------------------------------------------- */
/* Reading tasks & workspaces from the store                                 */
/* -------------------------------------------------------------------------- */

/** All tasks currently in the Redux store. */
export function useCalendarTasks(): Task[] {
  return useSelector(selectTasks)
}

/** All workspaces currently in the Redux store. */
export function useCalendarWorkspaces(): Workspace[] {
  return useSelector(selectWorkspaces)
}

/** id -> Workspace lookup, memoised so it can be passed down cheaply. */
export function useWorkspaceMap(): Map<string, Workspace> {
  const workspaces = useCalendarWorkspaces()
  return useMemo(() => new Map(workspaces.map((w) => [w.id, w])), [workspaces])
}

/** Only tasks that have a concrete start date/time — the ones the grid can place. */
export function useScheduledTasks(): Task[] {
  const tasks = useCalendarTasks()
  return useMemo(() => tasks.filter((t) => normalizeTimestamp(t.startDate) != null), [tasks])
}

/* -------------------------------------------------------------------------- */
/* Workspace & status presentation                                           */
/* -------------------------------------------------------------------------- */

// Workspaces are user-created, so instead of a fixed map we pick a
// deterministic colour from a palette based on the workspace id. Using the id
// (not the name) keeps the colour stable when a workspace is renamed.
const WORKSPACE_PALETTE = [
  "var(--color-primary)",
  "var(--color-steel)",
  "var(--color-text-secondary)",
  "var(--color-muted)",
  "var(--color-border-strong)",
  "var(--color-warning)",
  "var(--color-success)",
  "var(--color-destructive)",
]

const NO_WORKSPACE_COLOR = "var(--color-muted-foreground)"

function hashString(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

/** Resolve a task's workspace from a list (or null if it can't be found). */
export function getTaskWorkspace(task: Task, workspaces: Workspace[]): Workspace | null {
  return workspaces.find((w) => w.id === task.workspaceId) ?? null
}

/**
 * Visual tokens for a workspace.
 *
 * Returns inline styles rather than Tailwind arbitrary-value classes:
 * Tailwind only generates classes it can find as complete strings in source,
 * so classes built via `bg-[${color}]` interpolation are never emitted.
 */
export function getWorkspaceVisual(workspace: Workspace | null | undefined) {
  const color = workspace
    ? WORKSPACE_PALETTE[hashString(workspace.id) % WORKSPACE_PALETTE.length]
    : NO_WORKSPACE_COLOR

  const dotStyle: CSSProperties = { backgroundColor: color }
  const chipStyle: CSSProperties = {
    backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)`,
    color,
  }
  const borderStyle: CSSProperties = { borderColor: color }

  return {
    label: workspace?.name ?? "No workspace",
    color,
    dotStyle,
    chipStyle,
    borderStyle,
  }
}

// The four store statuses map 1:1 onto the four badge variants, so each
// status reads as visually distinct at a glance.
export const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; badge: "default" | "secondary" | "outline" | "destructive" }
> = {
  TODO: { label: STATUS_META.TODO.title, badge: "outline" },
  IN_PROGRESS: { label: STATUS_META.IN_PROGRESS.title, badge: "default" },
  ON_HOLD: { label: STATUS_META.ON_HOLD.title, badge: "destructive" },
  COMPLETED: { label: STATUS_META.COMPLETED.title, badge: "secondary" },
}

export function getPriorityVisual(priority: TaskPriority) {
  const meta = PRIORITY_META[priority]

  return {
    label: meta.label,
    color: meta.color,
    dotStyle: { backgroundColor: meta.color } as CSSProperties,
    chipStyle: { backgroundColor: meta.bg, color: meta.color } as CSSProperties,
  }
}

/* -------------------------------------------------------------------------- */
/* Filtering                                                                 */
/* -------------------------------------------------------------------------- */

/** Tasks belonging to one workspace; pass null/undefined for "all workspaces". */
export function getTasksForWorkspace(tasks: Task[], workspaceId: string | null | undefined): Task[] {
  if (!workspaceId) return tasks
  return tasks.filter((t) => t.workspaceId === workspaceId)
}

/* -------------------------------------------------------------------------- */
/* Date helpers                                                              */
/* -------------------------------------------------------------------------- */

/** yyyy-MM-dd key for grouping/lookups, e.g. by a day column. */
export function getDateKey(date: Date) {
  return format(date, "yyyy-MM-dd")
}

/** The task's scheduled start as a Date, or null if it has none. */
export function getTaskStartDate(task: Task): Date | null {
  const ts = normalizeTimestamp(task.startDate)
  return ts == null ? null : new Date(ts)
}

/** The task's scheduled end as a Date (start + planned duration). */
export function getTaskEndDate(task: Task): Date | null {
  const start = getTaskStartDate(task)
  if (!start) return null
  return addSeconds(start, task.plannedDurationSeconds)
}

export function getTasksForDate(tasks: Task[], date: Date): Task[] {
  return tasks
    .filter((t) => {
      const start = getTaskStartDate(t)
      return start != null && isSameDay(start, date)
    })
    .sort((a, b) => getTaskStartDate(a)!.getTime() - getTaskStartDate(b)!.getTime())
}

export function getTaskTimeRange(task: Task) {
  const start = getTaskStartDate(task)
  if (!start) return { start: "—", end: "—" }

  const end = addSeconds(start, task.plannedDurationSeconds)

  return {
    start: format(start, "h:mm a"),
    end: format(end, "h:mm a"),
  }
}

/** "Xh Ym" style label for durations stored in seconds. */
export function formatDurationLabel(seconds: number) {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m`

  const h = Math.floor(minutes / 60)
  const m = minutes % 60

  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function isToday(date: Date) {
  return isSameDay(date, new Date())
}

/** Best-effort "anchor" date for a task: start date, else creation date. */
export function parseTaskDate(task: Task): Date {
  return getTaskStartDate(task) ?? new Date(task.createdAt)
}

export function formatWeekRange(anchor: Date) {
  const start = startOfWeek(anchor, { weekStartsOn: 1 })
  const end = endOfWeek(anchor, { weekStartsOn: 1 })

  if (isSameMonth(start, end)) {
    return `${format(start, "MMM d")} – ${format(end, "d, yyyy")}`
  }

  return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`
}

/* -------------------------------------------------------------------------- */
/* Time-grid layout (week/day views)                                        */
/* -------------------------------------------------------------------------- */

export const HOUR_HEIGHT = 64
export const GRID_START_HOUR = 0
export const GRID_END_HOUR = 24
export const DEFAULT_SCROLL_HOUR = 7

function minutesSinceMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes()
}

export function getTaskTopOffset(task: Task) {
  const start = getTaskStartDate(task)
  if (!start) return 0
  return (minutesSinceMidnight(start) / 60) * HOUR_HEIGHT
}

export function getTaskHeight(task: Task) {
  const minutes = task.plannedDurationSeconds / 60
  return Math.max((minutes / 60) * HOUR_HEIGHT, 26)
}

export interface PositionedTask extends Task {
  column: number
  columnCount: number
}

/**
 * Assigns overlapping tasks to side-by-side columns within a day, the same
 * way Google/Outlook style time-grid calendars lay out concurrent events.
 * Tasks with no startDate are dropped — they can't be placed on the grid.
 */
export function layoutTasksForDay(tasks: Task[]): PositionedTask[] {
  const items = tasks
    .map((task) => {
      const start = getTaskStartDate(task)

      if (!start) return null

      const startMin = minutesSinceMidnight(start)
      const durationMin = task.plannedDurationSeconds / 60
      const endMin = startMin + durationMin

      return {
        task,
        startMin,
        endMin,
      }
    })
    .filter(
      (
        item
      ): item is {
        task: Task
        startMin: number
        endMin: number
      } => item !== null
    )
    .sort((a, b) => {
      if (a.startMin !== b.startMin) {
        return a.startMin - b.startMin
      }

      return b.endMin - a.endMin
    })

  const result: PositionedTask[] = []

  // Each array represents one visual column.
  const columns: {
    task: Task
    startMin: number
    endMin: number
  }[][] = []

  for (const item of items) {
    let columnIndex = -1

    // Find the first column where the previous task has completely finished.
    for (let i = 0; i < columns.length; i++) {
      const column = columns[i]
      const last = column[column.length - 1]

      if (last.endMin <= item.startMin) {
        columnIndex = i
        break
      }
    }

    // No free column → create a new one.
    if (columnIndex === -1) {
      columnIndex = columns.length
      columns.push([])
    }

    columns[columnIndex].push(item)

    result.push({
      ...item.task,
      column: columnIndex,
      columnCount: 1,
    })
  }

  /*
   * Calculate the number of columns required for each task.
   * Not every task in the day needs the same columnCount.
   */
  for (const positionedTask of result) {
    const taskStart = getTaskStartDate(positionedTask)

    if (!taskStart) continue

    const startMin = minutesSinceMidnight(taskStart)
    const endMin = startMin + positionedTask.plannedDurationSeconds / 60

    const overlappingColumns = new Set<number>()

    for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {
      const column = columns[columnIndex]

      for (const other of column) {
        const overlaps = other.startMin < endMin && other.endMin > startMin

        if (overlaps) {
          overlappingColumns.add(columnIndex)
          break
        }
      }
    }

    positionedTask.columnCount = Math.max(
      overlappingColumns.size,
      positionedTask.column + 1
    )
  }

  return result
}

export function getWeekDays(anchor: Date) {
  const start = startOfWeek(anchor, { weekStartsOn: 1 })
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}