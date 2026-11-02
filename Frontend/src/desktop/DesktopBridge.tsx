import { useEffect, useRef } from "react"
import { useDispatch, useSelector, useStore } from "react-redux"
import { useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { refreshSession } from "../api/session"
import { IS_DESKTOP } from "../lib/api-origin"
import type { AppDispatch } from "../store"
import { fetchTasks, type TasksRootState } from "../store/slices/taskSlice"
import { DESKTOP_EVENTS, desktopStatusKey, notify, preferencesKey, updateTray } from "./desktop-api"
import { errorMessage, isTauri, listen } from "./tauri"
import { timerAction, timerStore, useTimer, type LiveTimer } from "./timer-store"
import type { DesktopPreferences, TimerAction, TrayStatus } from "./types"

/**
 * Runs in the main window only. The main window owns the user's session, so
 * it relays the backend timer to the tray, executes tray and global-shortcut
 * actions, raises completion notifications, and keeps the Redux task board in
 * sync when the timer is changed from the tray or the floating window.
 */
export function DesktopBridge() {
  if (!IS_DESKTOP || !isTauri()) return null
  return <Bridge />
}

const SESSION_KEEPALIVE_MS = 10 * 60 * 1000

const ACTIONS: Record<string, TimerAction> = {
  toggleTimer: "toggle",
  resetTimer: "reset",
  startTimer: "start",
  pauseTimer: "pause",
}

function Bridge() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const dispatch = useDispatch<AppDispatch>()
  const store = useStore<TasksRootState>()
  const isAuthenticated = useSelector((state: TasksRootState) => Boolean(state.auth?.isAuthenticated))
  const live = useTimer({ enabled: isAuthenticated })

  useTrayRelay(live, isAuthenticated)
  useBoardSync(live, store, dispatch)

  // Access tokens are short-lived. While the dashboard sits hidden in the
  // tray it makes no requests, so renew the session here to keep the
  // floating window's stream and tray actions authorized.
  useEffect(() => {
    if (!isAuthenticated) return
    const id = window.setInterval(() => void refreshSession(), SESSION_KEEPALIVE_MS)
    return () => window.clearInterval(id)
  }, [isAuthenticated])

  useEffect(() => {
    const unlisteners = [
      listen<string>(DESKTOP_EVENTS.action, (name) => {
        const action = ACTIONS[name]
        if (!action) return
        timerAction(action).catch((error) => {
          void notify("Timer", errorMessage(error, "The timer action failed."))
        })
      }),
      listen<string>(DESKTOP_EVENTS.navigate, (path) => navigate(path)),
      listen<DesktopPreferences>(DESKTOP_EVENTS.preferences, (prefs) =>
        queryClient.setQueryData(preferencesKey, prefs),
      ),
      listen(DESKTOP_EVENTS.backendRestarted, () => {
        void queryClient.invalidateQueries({ queryKey: desktopStatusKey })
        timerStore.reconnect()
        if (store.getState().auth?.isAuthenticated) void dispatch(fetchTasks())
      }),
    ]
    const unsubscribeCompleted = timerStore.onCompleted((state) => {
      void notify(
        "Planned time reached",
        state.taskTitle ? `"${state.taskTitle}" reached its planned time. The timer keeps counting overtime.` : "Your focus session reached its planned time.",
      )
    })
    return () => {
      unsubscribeCompleted()
      unlisteners.forEach((p) => void p.then((off) => off()))
    }
  }, [navigate, queryClient, dispatch, store])

  return null
}

function minutesLabel(seconds: number) {
  const minutes = Math.ceil(seconds / 60)
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m ? `${h} h ${m} min` : `${h} h`
  }
  return `${minutes} min`
}

function trayStatusFor(live: LiveTimer, isAuthenticated: boolean): TrayStatus {
  const state = live.state
  if (!isAuthenticated || live.connection === "signed-out") {
    return { label: "Sign in to use the timer", tooltip: "Notch Buddy", running: false, hasTask: false }
  }
  if (live.connection === "unavailable") {
    return { label: "Database unavailable", tooltip: "Notch Buddy: database unavailable", running: false, hasTask: false }
  }
  if (!state || state.status === "idle" || !state.taskId) {
    return { label: "No active task", tooltip: "Notch Buddy", running: false, hasTask: false }
  }
  const title = state.taskTitle || "Task"
  const planned = state.plannedSeconds
  let detail: string
  if (planned <= 0) detail = `${minutesLabel(live.spentSeconds)} spent`
  else if (live.overtimeSeconds > 0) detail = `${minutesLabel(live.overtimeSeconds)} overtime`
  else detail = `${minutesLabel(live.remainingSeconds)} left`

  const prefix = live.isRunning ? (live.overtimeSeconds > 0 ? "Overtime" : "Focus") : "Paused"
  return {
    label: `${prefix}: ${detail}`,
    tooltip: `${title} · ${detail}${live.isRunning ? "" : " (paused)"}`,
    running: live.isRunning,
    hasTask: true,
  }
}

/** Pushes the tray text only when it changes (minute granularity). */
function useTrayRelay(live: LiveTimer, isAuthenticated: boolean) {
  const last = useRef("")
  const status = trayStatusFor(live, isAuthenticated)
  const key = JSON.stringify(status)
  useEffect(() => {
    if (key === last.current) return
    last.current = key
    updateTray(JSON.parse(key) as TrayStatus).catch(() => {})
  }, [key])
}

/**
 * When the timer changes outside this window (tray, shortcut, floating
 * window, another device), reload tasks so the board and Redux timer match
 * the backend.
 */
function useBoardSync(live: LiveTimer, store: { getState(): TasksRootState }, dispatch: AppDispatch) {
  const state = live.state
  const signature = state ? `${state.status}:${state.taskId ?? ""}:${state.sessionStartedAt ?? ""}` : ""

  useEffect(() => {
    if (!state || !signature) return
    const { tasks } = store.getState()
    if (tasks.pendingIds.length > 0 || tasks.status !== "succeeded") return

    const inProgress = tasks.tasks.find((t) => t.status === "IN_PROGRESS")
    const backendRunningId = state.status === "running" ? state.taskId : null
    if ((inProgress?.id ?? null) !== backendRunningId) {
      void dispatch(fetchTasks())
    }
    // `signature` captures every relevant change of `state`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, store, dispatch])
}
