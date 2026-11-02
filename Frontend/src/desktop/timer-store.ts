import { useEffect, useState, useSyncExternalStore } from "react"
import { API_BASE_URL } from "../lib/api-origin"
import { refreshSession, isSessionRejected } from "../api/session"
import type { TimerAction, TimerState } from "./types"

/**
 * Client for the backend-owned global timer. Each window keeps one
 * Server-Sent Events connection to /api/timer/events and shares it between
 * every component through useSyncExternalStore. The backend is the only
 * source of truth: the client just ticks the display between updates.
 */

export type TimerConnection = "connecting" | "open" | "unavailable" | "signed-out"

interface Snapshot {
  state: TimerState | null
  /** Local Date.now() when `state` arrived, used to tick a running timer. */
  receivedAt: number
  connection: TimerConnection
}

let snapshot: Snapshot = { state: null, receivedAt: 0, connection: "connecting" }
const listeners = new Set<() => void>()
const completedListeners = new Set<(state: TimerState) => void>()

let source: EventSource | null = null
let consumers = 0
let retryHandle: number | null = null
let retryDelayMs = 1000
// Only the main window refreshes the auth cookie. Refresh tokens rotate, so
// two windows refreshing at once would invalidate each other; the floating
// window simply retries and picks up the cookie the main window renewed.
let allowRefresh = true

export function configureTimerClient(options: { allowRefresh: boolean }) {
  allowRefresh = options.allowRefresh
}

function emit(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next }
  listeners.forEach((listener) => listener())
}

function parse(event: Event): TimerState | null {
  try {
    return JSON.parse((event as MessageEvent<string>).data) as TimerState
  } catch {
    return null
  }
}

function clearRetry() {
  if (retryHandle != null) {
    window.clearTimeout(retryHandle)
    retryHandle = null
  }
}

function closeSource() {
  source?.close()
  source = null
}

function connect() {
  clearRetry()
  closeSource()

  const es = new EventSource(`${API_BASE_URL}/timer/events`, { withCredentials: true })
  source = es

  es.addEventListener("state", (event) => {
    const state = parse(event)
    if (!state) return
    retryDelayMs = 1000
    emit({ state, receivedAt: Date.now(), connection: "open" })
  })
  es.addEventListener("completed", (event) => {
    const state = parse(event)
    if (state) completedListeners.forEach((listener) => listener(state))
  })
  es.addEventListener("unavailable", () => emit({ connection: "unavailable" }))

  es.onerror = () => {
    // CONNECTING means the browser is already retrying (network blip or
    // backend restart). CLOSED means the server refused, usually a 401 from
    // an expired access token.
    if (es.readyState !== EventSource.CLOSED) return
    if (source === es) source = null
    void recover()
  }
}

async function recover() {
  if (allowRefresh) {
    const result = await refreshSession()
    if (isSessionRejected(result)) {
      emit({ state: null, connection: "signed-out" })
      return
    }
  }
  scheduleRetry()
}

function scheduleRetry() {
  if (retryHandle != null || consumers === 0) return
  retryHandle = window.setTimeout(() => {
    retryHandle = null
    if (consumers > 0) connect()
  }, retryDelayMs)
  retryDelayMs = Math.min(retryDelayMs * 2, 30_000)
}

export const timerStore = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  getSnapshot: () => snapshot,

  /** Keeps the stream open while at least one consumer is mounted. */
  retain() {
    consumers += 1
    if (consumers === 1) connect()
    return () => {
      consumers = Math.max(0, consumers - 1)
      if (consumers === 0) {
        clearRetry()
        closeSource()
      }
    }
  },

  /** Reconnect now, e.g. after the backend restarted or the user signed in. */
  reconnect() {
    retryDelayMs = 1000
    if (consumers > 0) connect()
  },

  onCompleted(listener: (state: TimerState) => void) {
    completedListeners.add(listener)
    return () => {
      completedListeners.delete(listener)
    }
  },

  applyState(state: TimerState) {
    emit({ state, receivedAt: Date.now(), connection: "open" })
  },
}

/** Performs a timer action on the backend; every window updates via SSE. */
export async function timerAction(action: TimerAction, body: Record<string, unknown> = {}): Promise<TimerState> {
  const send = () =>
    fetch(`${API_BASE_URL}/timer/${action}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

  let response = await send()
  if (response.status === 401 && allowRefresh && (await refreshSession()).ok) {
    response = await send()
  }
  const payload = await response.json().catch(() => null)
  if (response.status === 401) {
    throw new Error("Sign in to the dashboard to use the timer.")
  }
  if (!response.ok) {
    throw new Error(payload?.error ?? payload?.message ?? `Timer request failed (${response.status}).`)
  }
  timerStore.applyState(payload as TimerState)
  return payload as TimerState
}

export interface LiveTimer {
  state: TimerState | null
  connection: TimerConnection
  spentSeconds: number
  remainingSeconds: number
  overtimeSeconds: number
  isRunning: boolean
}

/** Subscribes to the shared stream and ticks the display once per second. */
export function useTimer({ enabled = true }: { enabled?: boolean } = {}): LiveTimer {
  const current = useSyncExternalStore(timerStore.subscribe, timerStore.getSnapshot)
  const [now, setNow] = useState(() => Date.now())
  const isRunning = current.state?.status === "running"

  useEffect(() => {
    if (!enabled) return
    return timerStore.retain()
  }, [enabled])

  useEffect(() => {
    if (!isRunning) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [isRunning])

  // After sleep or when a hidden window is shown again, resync immediately
  // instead of waiting for the next server refresh.
  useEffect(() => {
    if (!enabled) return
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setNow(Date.now())
        if (timerStore.getSnapshot().connection !== "open") timerStore.reconnect()
      }
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("online", timerStore.reconnect)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("online", timerStore.reconnect)
    }
  }, [enabled])

  const state = current.state
  const elapsed = isRunning ? Math.max(0, Math.floor((now - current.receivedAt) / 1000)) : 0
  const spent = (state?.spentSeconds ?? 0) + elapsed
  const planned = state?.plannedSeconds ?? 0

  return {
    state,
    connection: current.connection,
    spentSeconds: spent,
    remainingSeconds: Math.max(0, planned - spent),
    overtimeSeconds: planned > 0 ? Math.max(0, spent - planned) : 0,
    isRunning,
  }
}

export function formatTimer(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, "0")
  const ss = String(sec).padStart(2, "0")
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Main display value: countdown, overtime, or count-up when unplanned. */
export function timerDisplay(live: LiveTimer): { value: string; overtime: boolean } {
  const planned = live.state?.plannedSeconds ?? 0
  if (planned <= 0) return { value: formatTimer(live.spentSeconds), overtime: false }
  if (live.overtimeSeconds > 0) return { value: `+${formatTimer(live.overtimeSeconds)}`, overtime: true }
  return { value: formatTimer(live.remainingSeconds), overtime: false }
}
