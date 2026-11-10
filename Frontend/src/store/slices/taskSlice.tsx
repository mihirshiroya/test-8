"use client"

import {
  createSlice,
  createAsyncThunk,
  type PayloadAction,
  type ThunkDispatch,
  type AnyAction,
} from "@reduxjs/toolkit"
import { useDispatch, useSelector, useStore } from "react-redux"
import { useCallback, useEffect, useMemo } from "react"
import type { TintKey, IconKey } from "../../components/Ui/project-data"
import { refreshSession } from "../../api/session"
import { API_ORIGIN } from "../../lib/api-origin"

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type TaskStatus = "TODO" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED"
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT"

export interface Workspace {
  id: string
  name: string
  description: string | null
  tint: TintKey
  icon: IconKey
  createdAt: number
  updatedAt: number
}

export interface WorkspaceInput {
  name: string
  description?: string
  tint?: TintKey
  icon?: IconKey
}

export type WorkspacePatch = Partial<WorkspaceInput>

export interface Task {
  id: string
  workspaceId: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  position: number
  startDate: number | null
  deadlineDate: number | null
  plannedDurationSeconds: number
  actualDurationSeconds: number
  startedAt: number | null
  completedAt: number | null
  createdAt: number
}

export type TimerPhase = "stopped" | "running" | "paused"

export interface TimerState {
  taskId: string | null
  phase: TimerPhase
  startedAt: number | null
  accumulatedSeconds: number
  lastCheckTime: number | null
  isStale: boolean
  /** Epoch ms when the unanswered check-in auto-holds the task. */
  checkDeadline: number | null
  /** Updated every second so selectors/memos re-render with the live clock. */
  now: number
}

/* -------------------------------------------------------------------------- */
/* Constants + pure helpers                                                   */
/* -------------------------------------------------------------------------- */

export const CHECK_INTERVAL_MS = 15 * 60 * 1000
export const RESPONSE_WINDOW_MS = 30 * 1000

export const COMPLETE_UNLOCK_RATIO = 0.75

export const STATUS_ORDER: TaskStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
]

export const STATUS_META: Record<
  TaskStatus,
  { title: string; accent: string; tint: string }
> = {
 TODO: {
  title: "To Do",
  accent: "var(--color-text-secondary)",
  tint: "var(--color-surface-soft)",
},
  IN_PROGRESS: {
    title: "In Progress",
    accent: "var(--color-primary)",
    tint: "var(--color-primary-soft)",
  },
  ON_HOLD: {
    title: "On Hold",
    accent: "var(--color-warning)",
    tint: "var(--color-warning-soft)",
  },
  COMPLETED: {
    title: "Completed",
    accent: "var(--color-success)",
    tint: "var(--color-success-soft)",
  },
}

export const PRIORITY_META: Record<
  TaskPriority,
  { label: string; color: string; bg: string }
> = {
  LOW: {
    label: "Low",
    color: "var(--color-success)",
    bg: "var(--color-success-soft)",
  },
  MEDIUM: {
    label: "Medium",
    color: "var(--color-primary)",
    bg: "var(--color-primary-soft)",
  },
  HIGH: {
    label: "High",
    color: "var(--color-warning)",
    bg: "var(--color-warning-soft)",
  },
  URGENT: {
    label: "Urgent",
    color: "var(--color-destructive)",
    bg: "var(--color-warning-soft)",
  },
}

export function normalizeTimestamp(ts: number | null): number | null {
  return ts
}

export function isLocked(status: TaskStatus): boolean {
  return status === "COMPLETED"
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)

  if (h > 0) return `${h}h ${m}m`

  return `${m}m`
}

export function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s
      .toString()
      .padStart(2, "0")}`
  }

  return `${m.toString().padStart(2, "0")}:${s
    .toString()
    .padStart(2, "0")}`
}

function spentSeconds(timer: TimerState): number {
  if (timer.phase === "running" && timer.startedAt) {
    return (
      timer.accumulatedSeconds +
      Math.max(0, Math.floor((Date.now() - timer.startedAt) / 1000))
    )
  }

  return timer.accumulatedSeconds
}

export function taskSpentSeconds(task: Task, timer: TimerState): number {
  return task.id === timer.taskId
    ? spentSeconds(timer)
    : task.actualDurationSeconds
}

function remainingSeconds(
  task: Task | null | undefined,
  timer: TimerState
): number {
  if (!task) return 0

  const spent = taskSpentSeconds(task, timer)

  return Math.max(0, task.plannedDurationSeconds - spent)
}

/**
 * Only one task can be actively "in progress" (timed) at a time.
 */
export function isTaskStartAllowed(
  tasks: Task[],
  timer: TimerState,
  targetTaskId: string
): boolean {
  const activeTask = tasks.find((t) => t.id === timer.taskId)

  if (!activeTask) return true

  if (activeTask.id === targetTaskId) return true

  return false
}

/**
 * A task can only move to COMPLETED once at least
 * COMPLETE_UNLOCK_RATIO of its planned duration has been spent.
 */
export function canCompleteTask(
  tasks: Task[],
  timer: TimerState,
  targetTaskId: string
): boolean {
  const task = tasks.find((t) => t.id === targetTaskId)

  if (!task) return false

  if (task.plannedDurationSeconds <= 0) return true

  const spent = taskSpentSeconds(task, timer)

  return spent >= task.plannedDurationSeconds * COMPLETE_UNLOCK_RATIO
}

export const IDLE_TIMER: TimerState = {
  taskId: null,
  phase: "stopped",
  startedAt: null,
  accumulatedSeconds: 0,
  lastCheckTime: null,
  isStale: false,
  checkDeadline: null,
  now: 0,
}

/* -------------------------------------------------------------------------- */
/* API layer                                                                  */
/* -------------------------------------------------------------------------- */

const TASKS_API = `${API_ORIGIN}/api/tasks`
const WORKSPACES_API = `${API_ORIGIN}/api/workspaces`

/**
 * One request helper for both controllers:
 *
 * tasks controller:      raw JSON / { error }
 * workspaces controller: { success, data, message }
 * DELETE /tasks/:id:     204 with no body
 */
export class TaskApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "TaskApiError"
    this.status = status
  }
}

async function request<T>(
  base: string,
  path: string,
  init?: RequestInit,
  retried = false
): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })

  if (response.status === 401 && !retried) {
    if ((await refreshSession()).ok) {
      return request<T>(base, path, init, true)
    }
  }

  if (response.status === 204) {
    return undefined as T
  }

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new TaskApiError(
      payload?.message ??
        payload?.error ??
        `Request failed (${response.status})`,
      response.status
    )
  }

  if (payload && typeof payload === "object" && "success" in payload) {
    if (!payload.success) {
      throw new Error(payload.message ?? "Request failed")
    }

    return payload.data as T
  }

  return payload as T
}

function body(obj: unknown): RequestInit {
  return {
    body: JSON.stringify(obj),
  }
}

interface ApiSession {
  id: string
  taskId?: string
  startedAt: number | null
  endedAt: number | null
  committedSeconds: number
}

/**
 * Shape returned by the tasks controller.
 */
interface ApiTask {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  workspaceId: string
  position: number
  createdAt: number | null
  updatedAt: number | null
  spentSeconds?: number
  startDate?: number | null
  deadlineDate?: number | null
  plannedDurationSeconds?: number
  actualDurationSeconds?: number
  startedAt?: number | null
  completedAt?: number | null
}

/**
 * A field the server sent explicitly (even as null) wins over the previous
 * value; otherwise clearing a date in the editor would never stick.
 */
function pick<K extends keyof ApiTask & keyof Task>(
  raw: ApiTask,
  key: K,
  prev: Task | undefined,
  fallback: Task[K]
): Task[K] {
  if (key in raw && raw[key] !== undefined) {
    return (raw[key] ?? fallback) as Task[K]
  }

  return prev ? prev[key] : fallback
}

function toTask(raw: ApiTask, prev?: Task): Task {
  return {
    id: raw.id,
    workspaceId: raw.workspaceId,
    title: raw.title,
    description: raw.description ?? "",
    status: raw.status,
    priority: raw.priority,
    position: raw.position,

    startDate: pick(raw, "startDate", prev, null),

    deadlineDate: pick(raw, "deadlineDate", prev, null),

    plannedDurationSeconds: pick(raw, "plannedDurationSeconds", prev, 0),

    actualDurationSeconds:
      raw.spentSeconds ??
      raw.actualDurationSeconds ??
      prev?.actualDurationSeconds ??
      0,

    startedAt: pick(raw, "startedAt", prev, null),

    completedAt:
      raw.completedAt ??
      (raw.status === "COMPLETED" ? raw.updatedAt ?? Date.now() : null),

    createdAt: raw.createdAt ?? prev?.createdAt ?? Date.now(),
  }
}

export interface TaskInput {
  title: string
  description: string
  priority: TaskPriority
  plannedDurationSeconds: number
  status: TaskStatus
  workspaceId: string
  startDate: number | null
  deadlineDate: number | null
}

export type TaskPatch = Partial<
  Pick<
    Task,
    | "title"
    | "description"
    | "workspaceId"
    | "priority"
    | "plannedDurationSeconds"
    | "startDate"
    | "deadlineDate"
  >
>

/* -------------------------------------------------------------------------- */
/* Slice state                                                                */
/* -------------------------------------------------------------------------- */

export type LoadStatus = "idle" | "loading" | "succeeded" | "failed"

export interface TaskSliceState {
  tasks: Task[]
  workspaces: Workspace[]
  timer: TimerState
  status: LoadStatus
  error: string | null
  pendingIds: string[]
}

export interface TasksRootState {
  tasks: TaskSliceState
  auth?: { isAuthenticated: boolean }
}

// authSlice imports this file, so match its actions by type string instead
// of importing them (avoids a circular import).
const AUTH_CLEARED = "auth/clearAuth"
const AUTH_LOGGED_OUT = "auth/logout/fulfilled"

const isSignedIn = (state: TasksRootState) => Boolean(state.auth?.isAuthenticated)

let tasksFetchInFlight = false

const initialState: TaskSliceState = {
  tasks: [],
  workspaces: [],
  timer: IDLE_TIMER,
  status: "idle",
  error: null,
  pendingIds: [],
}

/**
 * Keeps timer data consistent with the task list:
 *  - no IN_PROGRESS task          -> timer is reset to idle
 *  - timed task no longer running -> timer is reset to idle
 * Called after every mutation of `state.tasks` and on every tick, so the
 * timer can never keep "running" without an in-progress task.
 */
function syncTimer(state: TaskSliceState) {
  const timer = state.timer
  const isAlreadyIdle = timer.phase === "stopped" && timer.taskId === null

  if (isAlreadyIdle) return

  const inProgressIds = state.tasks
    .filter((t) => t.status === "IN_PROGRESS")
    .map((t) => t.id)

  if (
    inProgressIds.length === 0 ||
    (timer.taskId && !inProgressIds.includes(timer.taskId))
  ) {
    state.timer = IDLE_TIMER
  }
}

interface FetchPayload {
  tasks: ApiTask[]
  workspaces: Workspace[]
  activeSession: ApiSession | null
  activeAccumulatedSeconds: number
}

/**
 * Loads tasks + workspaces + active session.
 */
export const fetchTasks = createAsyncThunk<
  FetchPayload,
  void,
  { state: TasksRootState }
>(
  "tasks/fetch",
  async (_arg, { getState, dispatch }) => {
    tasksFetchInFlight = true

    let data: {
      tasks: ApiTask[]
      workspaces?: Workspace[]
      activeSession?: ApiSession | null
    }
    let workspacesFromApi: Workspace[] | null

    try {
      ;[data, workspacesFromApi] = await Promise.all([
        request<{
          tasks: ApiTask[]
          workspaces?: Workspace[]
          activeSession?: ApiSession | null
        }>(TASKS_API, ""),

        // Workspaces live on their own endpoint
        request<{ workspaces: Workspace[] }>(WORKSPACES_API, "")
          .then((r) => r?.workspaces ?? null)
          .catch(() => null),
      ])
    } catch (error) {
      // Session is gone even after a refresh: end it locally so the router
      // sends the user to /login instead of retrying forever.
      if (error instanceof TaskApiError && error.status === 401) {
        dispatch({ type: AUTH_CLEARED })
      }
      throw error
    } finally {
      tasksFetchInFlight = false
    }

    const activeSession = data.activeSession ?? null
    let activeAccumulatedSeconds = 0

    if (activeSession?.taskId) {
      // spentSeconds includes the open session's last synced checkpoint, so
      // subtract it: the live part is re-derived from activeSession.startedAt.
      const activeRaw = (data.tasks ?? []).find(
        (t) => t.id === activeSession.taskId
      )

      activeAccumulatedSeconds = Math.max(
        0,
        (activeRaw?.spentSeconds ?? activeRaw?.actualDurationSeconds ?? 0) -
          (activeSession.committedSeconds ?? 0)
      )
    }

    // Priority: dedicated endpoint -> tasks endpoint -> existing state.
    const resolvedWorkspaces: Workspace[] =
      workspacesFromApi ??
      data.workspaces ??
      getState().tasks.workspaces ??
      []

    return {
      tasks: data.tasks ?? [],
      workspaces: resolvedWorkspaces,
      activeSession,
      activeAccumulatedSeconds,
    }
  },
  {
    // Never fetch for signed-out visitors, and never run two *initial* loads
    // at once (pending only flips idle -> loading, so a retry from "failed"
    // isn't deduped by status). Post-mutation refetches are still allowed
    // to overlap so the latest write is always reflected.
    condition: (_arg, { getState }) => {
      const state = getState()
      if (!isSignedIn(state)) return false
      if (state.tasks.status === "loading") return false
      return !(tasksFetchInFlight && state.tasks.status !== "succeeded")
    },
  }
)

const sortByPosition = (a: Task, b: Task) => a.position - b.position

const taskSlice = createSlice({
  name: "tasks",
  initialState,

  reducers: {
    tasksReplaced: (state, action: PayloadAction<Task[]>) => {
      state.tasks = action.payload
      syncTimer(state)
    },

    workspacesReplaced: (state, action: PayloadAction<Workspace[]>) => {
      state.workspaces = action.payload
    },

    taskUpdatedLocally: (state, action: PayloadAction<Task>) => {
      const idx = state.tasks.findIndex((t) => t.id === action.payload.id)

      if (idx !== -1) {
        state.tasks[idx] = action.payload
      } else {
        state.tasks.push(action.payload)
      }

      syncTimer(state)
    },

    taskDeletedLocally: (state, action: PayloadAction<string>) => {
      state.tasks = state.tasks.filter((t) => t.id !== action.payload)

      if (state.timer.taskId === action.payload) {
        state.timer = IDLE_TIMER
      }

      syncTimer(state)
    },

    taskMovedLocally: (
      state,
      action: PayloadAction<{
        id: string
        status: TaskStatus
        workspaceId: string
        index: number
      }>
    ) => {
      const { id, status, workspaceId, index } = action.payload

      const task = state.tasks.find((t) => t.id === id)

      if (!task) return

      const oldStatus = task.status
      const oldWorkspaceId = task.workspaceId

      const target = state.tasks
        .filter(
          (t) =>
            t.id !== id &&
            t.status === status &&
            t.workspaceId === workspaceId
        )
        .sort(sortByPosition)

      const at = Math.max(0, Math.min(index, target.length))

      target.splice(at, 0, task)

      target.forEach((t, i) => {
        t.position = i
      })

      task.status = status
      task.workspaceId = workspaceId

      if (oldStatus !== status || oldWorkspaceId !== workspaceId) {
        state.tasks
          .filter(
            (t) =>
              t.status === oldStatus && t.workspaceId === oldWorkspaceId
          )
          .sort(sortByPosition)
          .forEach((t, i) => {
            t.position = i
          })
      }

      // Moving the timed task out of IN_PROGRESS must stop the timer.
      syncTimer(state)
    },

    workspaceUpsertedLocally: (state, action: PayloadAction<Workspace>) => {
      if (!Array.isArray(state.workspaces)) {
        state.workspaces = []
      }

      const idx = state.workspaces.findIndex(
        (w) => w.id === action.payload.id
      )

      if (idx !== -1) {
        state.workspaces[idx] = action.payload
      } else {
        state.workspaces.push(action.payload)
      }

      state.workspaces.sort((a, b) => a.name.localeCompare(b.name))
    },

    workspaceDeletedLocally: (state, action: PayloadAction<string>) => {
      const id = action.payload

      const removedTaskIds = state.tasks
        .filter((t) => t.workspaceId === id)
        .map((t) => t.id)

      state.workspaces = state.workspaces.filter((w) => w.id !== id)

      state.tasks = state.tasks.filter((t) => t.workspaceId !== id)

      if (state.timer.taskId && removedTaskIds.includes(state.timer.taskId)) {
        state.timer = IDLE_TIMER
      }

      syncTimer(state)
    },

    timerSet: (state, action: PayloadAction<TimerState>) => {
      state.timer = action.payload
    },

    timerUpdated: (state, action: PayloadAction<Partial<TimerState>>) => {
      state.timer = {
        ...state.timer,
        ...action.payload,
      }
    },

    timerCleared: (state) => {
      state.timer = IDLE_TIMER
    },


    timerTick: (state) => {
      // Never tick without an in-progress task.
      syncTimer(state)

      if (state.timer.phase !== "running") return

      const now = Date.now()

      // Changing `now` each second makes the live clock (notch, panel,
      // dialog countdown) re-render every second.
      state.timer.now = now

      // lastCheckTime is the last time the user confirmed (or the session
      // began). It must NOT be refreshed on every tick, otherwise the
      // check-in reminder would never fire.
      if (state.timer.lastCheckTime == null) {
        state.timer.lastCheckTime = now
        return
      }

      if (!state.timer.isStale && now - state.timer.lastCheckTime >= CHECK_INTERVAL_MS) {
        state.timer.isStale = true
        state.timer.checkDeadline = state.timer.lastCheckTime + CHECK_INTERVAL_MS + RESPONSE_WINDOW_MS
      }
    },

    pendingAdd: (state, action: PayloadAction<string>) => {
      if (!Array.isArray(state.pendingIds)) {
        state.pendingIds = []
      }

      if (!state.pendingIds.includes(action.payload)) {
        state.pendingIds.push(action.payload)
      }
    },

    pendingRemove: (state, action: PayloadAction<string>) => {
      if (!Array.isArray(state.pendingIds)) {
        state.pendingIds = []
        return
      }

      state.pendingIds = state.pendingIds.filter((id) => id !== action.payload)
    },

    errorSet: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(fetchTasks.pending, (state) => {
        if (state.status === "idle") {
          state.status = "loading"
        }
      })

      .addCase(fetchTasks.fulfilled, (state, action) => {
        const { tasks, workspaces, activeSession, activeAccumulatedSeconds } =
          action.payload

        const prevById = new Map(state.tasks.map((t) => [t.id, t]))

        state.status = "succeeded"

        state.tasks = tasks.map((raw) => toTask(raw, prevById.get(raw.id)))

        state.workspaces = Array.isArray(workspaces) ? workspaces : []

        // Timer only runs if the server's active session belongs to a task
        // that is actually IN_PROGRESS. Otherwise everything is reset.
        const sessionTask = activeSession?.taskId
          ? state.tasks.find((t) => t.id === activeSession.taskId)
          : undefined

        if (activeSession?.taskId && sessionTask?.status === "IN_PROGRESS") {
          const prev = state.timer

          const sameSession =
            prev.taskId === activeSession.taskId && prev.phase === "running"

          state.timer = {
            taskId: activeSession.taskId,
            phase: "running",
            startedAt: activeSession.startedAt,
            accumulatedSeconds: activeAccumulatedSeconds,
            lastCheckTime: sameSession ? prev.lastCheckTime : Date.now(),
            isStale: sameSession ? prev.isStale : false,
            checkDeadline: sameSession ? prev.checkDeadline : null,
            now: Date.now(),
          }
        } else {
          state.timer = IDLE_TIMER
        }
      })

      .addCase(fetchTasks.rejected, (state, action) => {
        // A skipped run (condition returned false) is not a failure.
        if (action.meta.condition) return

        state.status = "failed"

        state.error = action.error.message || "Failed to load tasks"
      })

      // Drop the previous user's data on sign-out so the next sign-in
      // starts from "idle" and loads fresh data exactly once.
      .addMatcher(
        (action: AnyAction) =>
          action.type === AUTH_CLEARED || action.type === AUTH_LOGGED_OUT,
        () => initialState
      )
  },
})

export const {
  tasksReplaced,
  workspacesReplaced,
  taskUpdatedLocally,
  taskDeletedLocally,
  taskMovedLocally,
  workspaceUpsertedLocally,
  workspaceDeletedLocally,
  timerSet,
  timerUpdated,
  timerCleared,
  timerTick,
  pendingAdd,
  pendingRemove,
  errorSet,
} = taskSlice.actions

export default taskSlice.reducer

/* -------------------------------------------------------------------------- */
/* Selectors                                                                  */
/* -------------------------------------------------------------------------- */

export const selectTasks = (state: TasksRootState): Task[] =>
  state.tasks?.tasks ?? []

export const selectWorkspaces = (state: TasksRootState): Workspace[] =>
  state.tasks?.workspaces ?? []

export const selectTimer = (state: TasksRootState): TimerState =>
  state.tasks?.timer ?? IDLE_TIMER

export const selectTasksStatus = (state: TasksRootState): LoadStatus =>
  state.tasks?.status ?? "idle"

export const selectTasksError = (state: TasksRootState): string | null =>
  state.tasks?.error ?? null

export const selectPendingIds = (state: TasksRootState): string[] =>
  state.tasks?.pendingIds ?? []

/** True only while at least one task is IN_PROGRESS. */
export const selectHasInProgressTask = (state: TasksRootState): boolean =>
  (state.tasks?.tasks ?? []).some((t) => t.status === "IN_PROGRESS")

type AppDispatch = ThunkDispatch<TasksRootState, unknown, AnyAction>

async function run(
  dispatch: AppDispatch,
  id: string,
  fn: () => Promise<void>
) {
  dispatch(pendingAdd(id))
  dispatch(errorSet(null))

  try {
    await fn()
  } catch (err) {
    dispatch(
      errorSet(err instanceof Error ? err.message : "An error occurred")
    )
  } finally {
    dispatch(pendingRemove(id))
  }
}

/* -------------------------------------------------------------------------- */
/* Task thunks                                                                */
/* -------------------------------------------------------------------------- */

export const addTask =
  (input: TaskInput) =>
  async (dispatch: AppDispatch): Promise<boolean> => {
    let success = false

    await run(dispatch, "add", async () => {
      const raw = await request<ApiTask>(TASKS_API, "", {
        method: "POST",
        ...body(input),
      })

      dispatch(taskUpdatedLocally(toTask(raw)))

      if (raw.status === "IN_PROGRESS") {
        await dispatch(fetchTasks())
      }

      success = true
    })

    return success
  }

export const updateTask =
  (id: string, patch: TaskPatch) =>
  async (
    dispatch: AppDispatch,
    getState: () => TasksRootState
  ): Promise<boolean> => {
    let success = false

    await run(dispatch, id, async () => {
      const prev = getState().tasks.tasks.find((t) => t.id === id)

      const raw = await request<ApiTask>(TASKS_API, `/${id}`, {
        method: "PATCH",
        ...body(patch),
      })

      dispatch(taskUpdatedLocally(toTask(raw, prev)))

      if (
        patch.workspaceId &&
        prev &&
        patch.workspaceId !== prev.workspaceId
      ) {
        await dispatch(fetchTasks())
      }

      success = true
    })

    return success
  }

export const deleteTask =
  (id: string) =>
  async (dispatch: AppDispatch): Promise<boolean> => {
    let success = false

    await run(dispatch, id, async () => {
      await request<void>(TASKS_API, `/${id}`, {
        method: "DELETE",
      })

      dispatch(taskDeletedLocally(id))

      await dispatch(fetchTasks())

      success = true
    })

    return success
  }

export const moveTask =
  (id: string, to: TaskStatus, index: number, workspaceId?: string) =>
  async (
    dispatch: AppDispatch,
    getState: () => TasksRootState
  ): Promise<boolean> => {
    let success = false

    await run(dispatch, id, async () => {
      const state = getState().tasks

      const task = state.tasks.find((t) => t.id === id)

      if (!task) {
        throw new Error("Task not found")
      }

      if (isLocked(task.status)) {
        throw new Error("Cannot move a completed task")
      }

      if (to === "IN_PROGRESS" && task.status !== "IN_PROGRESS") {
        if (!isTaskStartAllowed(state.tasks, state.timer, id)) {
          throw new Error("Cannot start task while another is running")
        }
      }

      if (to === "COMPLETED" && !canCompleteTask(state.tasks, state.timer, id)) {
        throw new Error("Cannot complete this task")
      }

      dispatch(
        taskMovedLocally({
          id,
          status: to,
          workspaceId: workspaceId ?? task.workspaceId,
          index,
        })
      )

      try {
        await request<ApiTask>(TASKS_API, `/${id}/move`, {
          method: "PATCH",
          ...body({
            status: to,
            index,
            ...(workspaceId ? { workspaceId } : {}),
          }),
        })
      } catch (err) {
        await dispatch(fetchTasks())

        throw err
      }

      await dispatch(fetchTasks())

      success = true
    })

    return success
  }

export const startTask =
  (id: string) =>
  async (
    dispatch: AppDispatch,
    getState: () => TasksRootState
  ): Promise<boolean> => {
    let success = false

    await run(dispatch, id, async () => {
      const state = getState().tasks

      const task = state.tasks.find((t) => t.id === id)

      if (!task) {
        throw new Error("Task not found")
      }

      if (task.status === "IN_PROGRESS") {
        return
      }

      if (!isTaskStartAllowed(state.tasks, state.timer, id)) {
        throw new Error("Cannot start task while another is running")
      }

      const raw = await request<ApiTask>(TASKS_API, `/${id}/start`, {
        method: "POST",
      })

      dispatch(taskUpdatedLocally(toTask(raw, task)))

      await dispatch(fetchTasks())

      success = true
    })

    return success
  }

export const holdTask =
  (id: string) =>
  async (
    dispatch: AppDispatch,
    getState: () => TasksRootState
  ): Promise<boolean> => {
    let success = false

    await run(dispatch, id, async () => {
      const prev = getState().tasks.tasks.find((t) => t.id === id)

      const raw = await request<ApiTask>(TASKS_API, `/${id}/hold`, {
        method: "POST",
      })

      dispatch(taskUpdatedLocally(toTask(raw, prev)))

      await dispatch(fetchTasks())

      success = true
    })

    return success
  }

/**
 * Puts every IN_PROGRESS task on hold. Used before logout so a running task
 * never keeps ticking after the user signs out. Never throws.
 */
export const holdAllInProgress =
  () =>
  async (dispatch: AppDispatch, getState: () => TasksRootState): Promise<void> => {
    const running = (getState().tasks?.tasks ?? []).filter(
      (t) => t.status === "IN_PROGRESS"
    )

    await Promise.allSettled(running.map((t) => dispatch(holdTask(t.id))))
  }

export const completeTask =
  (id: string) =>
  async (
    dispatch: AppDispatch,
    getState: () => TasksRootState
  ): Promise<boolean> => {
    let success = false

    await run(dispatch, id, async () => {
      const state = getState().tasks

      if (!canCompleteTask(state.tasks, state.timer, id)) {
        throw new Error("Cannot complete this task")
      }

      const prev = state.tasks.find((t) => t.id === id)

      const raw = await request<ApiTask>(TASKS_API, `/${id}/complete`, {
        method: "POST",
      })

      dispatch(taskUpdatedLocally(toTask(raw, prev)))

      await dispatch(fetchTasks())

      success = true
    })

    return success
  }

/**
 * Still working check-in.
 */
export const confirmActive =
  (id: string) =>
  async (
    dispatch: AppDispatch,
    getState: () => TasksRootState
  ): Promise<boolean> => {
    let success = false

    await run(dispatch, id, async () => {
      await request<{ committedSeconds: number }>(TASKS_API, `/${id}/sync`, {
        method: "POST",
      })

      const state = getState().tasks

      if (state.timer.taskId === id && state.timer.phase === "running") {
        dispatch(
          timerUpdated({
            lastCheckTime: Date.now(),
            isStale: false,
            checkDeadline: null,
          })
        )
      }

      success = true
    })

    return success
  }

/* -------------------------------------------------------------------------- */
/* Workspace thunks                                                           */
/* -------------------------------------------------------------------------- */

export const fetchWorkspaces =
  () =>
  async (dispatch: AppDispatch): Promise<boolean> => {
    dispatch(errorSet(null))

    try {
      const data = await request<{ workspaces: Workspace[] }>(
        WORKSPACES_API,
        ""
      )

      dispatch(workspacesReplaced(data.workspaces ?? []))

      return true
    } catch (error) {
      dispatch(
        errorSet(
          error instanceof Error ? error.message : "Failed to fetch workspaces"
        )
      )

      return false
    }
  }

export const addWorkspace =
  (input: WorkspaceInput) =>
  async (dispatch: AppDispatch): Promise<Workspace | null> => {
    dispatch(errorSet(null))

    try {
      const data = await request<{ workspace: Workspace }>(WORKSPACES_API, "", {
        method: "POST",
        ...body(input),
      })

      dispatch(workspaceUpsertedLocally(data.workspace))

      return data.workspace
    } catch (error) {
      dispatch(
        errorSet(
          error instanceof Error ? error.message : "Failed to create workspace"
        )
      )

      return null
    }
  }

export const updateWorkspace =
  (id: string, patch: WorkspacePatch) =>
  async (dispatch: AppDispatch): Promise<boolean> => {
    dispatch(errorSet(null))

    try {
      const data = await request<{ workspace: Workspace }>(
        WORKSPACES_API,
        `/${id}`,
        {
          method: "PATCH",
          ...body(patch),
        }
      )

      dispatch(workspaceUpsertedLocally(data.workspace))

      return true
    } catch (error) {
      dispatch(
        errorSet(
          error instanceof Error ? error.message : "Failed to update workspace"
        )
      )

      return false
    }
  }

export const deleteWorkspace =
  (id: string) =>
  async (dispatch: AppDispatch): Promise<boolean> => {
    dispatch(errorSet(null))

    try {
      await request<void>(WORKSPACES_API, `/${id}`, {
        method: "DELETE",
      })

      dispatch(workspaceDeletedLocally(id))

      await dispatch(fetchTasks())

      return true
    } catch (error) {
      dispatch(
        errorSet(
          error instanceof Error ? error.message : "Failed to delete workspace"
        )
      )

      return false
    }
  }

export const runTimerTick = () => (dispatch: AppDispatch) => {
  dispatch(timerTick())
}

/**
 * If the check-in popup was not answered within RESPONSE_WINDOW_MS,
 * move the running task to ON_HOLD.
 */
export const autoHoldIfExpired =
  () =>
  async (dispatch: AppDispatch, getState: () => TasksRootState): Promise<void> => {
    const { timer, pendingIds } = getState().tasks

    if (
      timer.phase !== "running" ||
      !timer.isStale ||
      !timer.taskId ||
      timer.checkDeadline == null ||
      Date.now() < timer.checkDeadline ||
      pendingIds.includes(timer.taskId)
    ) {
      return
    }

    await dispatch(holdTask(timer.taskId))
  }

/* -------------------------------------------------------------------------- */
/* Hooks                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Loads tasks once per signed-in session.
 *
 * - Signed-out visitors (login, register, home…) never trigger a request.
 * - A failed load is retried once when a consumer mounts or auth changes,
 *   not on every status change, so a dead backend can't cause a loop.
 */
function useEnsureTasksLoaded() {
  const dispatch = useDispatch<AppDispatch>()
  const store = useStore<TasksRootState>()
  const isAuthenticated = useSelector(
    (state: TasksRootState) => Boolean(state.auth?.isAuthenticated)
  )
  const status = useSelector(selectTasksStatus)

  useEffect(() => {
    if (isAuthenticated && status === "idle") {
      dispatch(fetchTasks())
    }
  }, [isAuthenticated, status, dispatch])

  useEffect(() => {
    if (isAuthenticated && store.getState().tasks.status === "failed") {
      dispatch(fetchTasks())
    }
  }, [isAuthenticated, store, dispatch])
}

export function useTaskStore() {
  const dispatch = useDispatch<AppDispatch>()

  const tasks = useSelector(selectTasks)
  const workspaces = useSelector(selectWorkspaces)
  const timer = useSelector(selectTimer)
  const status = useSelector(selectTasksStatus)
  const error = useSelector(selectTasksError)
  const pendingIds = useSelector(selectPendingIds)
  const hasActiveTask = useSelector(selectHasInProgressTask)

  useEnsureTasksLoaded()

  const clearError = useCallback(() => {
    dispatch(errorSet(null))
  }, [dispatch])

  return {
    tasks,
    workspaces,
    timer,
    status,
    error,
    pendingIds,
    hasActiveTask,
    clearError,

    addTask: (input: TaskInput) => dispatch(addTask(input)),

    updateTask: (id: string, patch: TaskPatch) =>
      dispatch(updateTask(id, patch)),

    deleteTask: (id: string) => dispatch(deleteTask(id)),

    moveTask: (
      id: string,
      to: TaskStatus,
      index: number,
      workspaceId?: string
    ) => dispatch(moveTask(id, to, index, workspaceId)),

    startTask: (id: string) => dispatch(startTask(id)),

    holdTask: (id: string) => dispatch(holdTask(id)),

    completeTask: (id: string) => dispatch(completeTask(id)),

    confirmActive: (id: string) => dispatch(confirmActive(id)),

    fetchTasks: () => dispatch(fetchTasks()),

    fetchWorkspaces: () => dispatch(fetchWorkspaces()),

    addWorkspace: (input: WorkspaceInput) => dispatch(addWorkspace(input)),

    updateWorkspace: (id: string, patch: WorkspacePatch) =>
      dispatch(updateWorkspace(id, patch)),

    deleteWorkspace: (id: string) => dispatch(deleteWorkspace(id)),
  }
}

/**
 * Lightweight hook for components that only need workspaces.
 */
export function useWorkspaceStore() {
  const dispatch = useDispatch<AppDispatch>()

  const workspaces = useSelector(selectWorkspaces)
  const status = useSelector(selectTasksStatus)
  const error = useSelector(selectTasksError)

  useEnsureTasksLoaded()

  const clearError = useCallback(() => {
    dispatch(errorSet(null))
  }, [dispatch])

  const add = useCallback(
    (input: WorkspaceInput) => dispatch(addWorkspace(input)),
    [dispatch]
  )

  const update = useCallback(
    (id: string, patch: WorkspacePatch) =>
      dispatch(updateWorkspace(id, patch)),
    [dispatch]
  )

  const remove = useCallback(
    (id: string) => dispatch(deleteWorkspace(id)),
    [dispatch]
  )

  return {
    workspaces,
    status,
    error,
    clearError,
    addWorkspace: add,
    updateWorkspace: update,
    deleteWorkspace: remove,
  }
}

/**
 * Convenience hook: true only while a task is IN_PROGRESS.
 * Use it to gate other timers, e.g. useActivityTimer({ userId, enabled }).
 */
export function useHasInProgressTask(): boolean {
  return useSelector(selectHasInProgressTask)
}

/* ------------------------- single shared 1s ticker ------------------------ */

let engineConsumers = 0
let engineInterval: ReturnType<typeof setInterval> | null = null

/**
 * Drives the Redux timer. Guarantees:
 *  - nothing runs unless the timer is "running" AND a task is IN_PROGRESS
 *  - only ONE interval exists app-wide, no matter how many components call it
 */
export function useTaskTimerEngine() {
  const dispatch = useDispatch<AppDispatch>()

  const shouldRun = useSelector(
    (state: TasksRootState) =>
      state.tasks.timer.phase === "running" && selectHasInProgressTask(state)
  )

  useEffect(() => {
    if (!shouldRun) return

    engineConsumers += 1

    if (engineConsumers === 1) {
      engineInterval = setInterval(() => {
        // The native check-in window remains answerable while the dashboard
        // is hidden. Never defer its deadline based on document visibility.
        dispatch(timerTick())
        void dispatch(autoHoldIfExpired())
      }, 1000)
    }

    return () => {
      engineConsumers -= 1

      if (engineConsumers <= 0) {
        engineConsumers = 0

        if (engineInterval != null) {
          clearInterval(engineInterval)
          engineInterval = null
        }
      }
    }
  }, [shouldRun, dispatch])
}

export function useActiveTask() {
  const tasks = useSelector(selectTasks)
  const timer = useSelector(selectTimer)
  const pendingIds = useSelector(selectPendingIds)

  // Only an IN_PROGRESS task can be the "active" timed task.
  const activeTask = useMemo(() => {
    if (!timer.taskId) {
      return null
    }

    const found = tasks.find((t) => t.id === timer.taskId)

    return found && found.status === "IN_PROGRESS" ? found : null
  }, [tasks, timer.taskId])

  const currentSpent = useMemo(() => {
    if (!activeTask) return 0

    return taskSpentSeconds(activeTask, timer)
  }, [activeTask, timer])

  const currentRemaining = useMemo(() => {
    if (!activeTask) return 0

    return remainingSeconds(activeTask, timer)
  }, [activeTask, timer])

  const isPending = activeTask ? pendingIds.includes(activeTask.id) : false

  const planned = activeTask?.plannedDurationSeconds ?? 0

  return {
    activeTask,
    timer,

    spentSeconds: currentSpent,

    remainingSeconds: currentRemaining,

    formattedSpent: formatClock(currentSpent),

    formattedRemaining: formatClock(currentRemaining),

    isOverdue: planned > 0 && currentSpent > planned,

    isPending,
  }
}

function startOfLocalDay(ms: number) {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export function useTodayTasks() {
  const tasks = useSelector(selectTasks)
  const todayStart = startOfLocalDay(Date.now())

  return useMemo(() => {
    return tasks.filter((task) => {
      const taskDay = startOfLocalDay(task.startDate ?? task.deadlineDate ?? task.createdAt)
      if (taskDay === todayStart) return true
      if (taskDay > todayStart) return false

      const done = task.status === "COMPLETED" || task.completedAt != null
      // Carried-over tasks stay visible on the day they get finished.
      return !done || (task.completedAt != null && startOfLocalDay(task.completedAt) === todayStart)
    })
  }, [tasks, todayStart])
}
