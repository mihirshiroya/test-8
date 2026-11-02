import { useEffect, useState, type ReactNode } from "react"
import { LayoutDashboard, Maximize2, Minimize2, Minus, Pause, Play, RotateCcw, X } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import {
  DESKTOP_EVENTS,
  hideFloating,
  minimizeFloating,
  preferencesKey,
  setFloatingCompact,
  showDashboard,
  usePreferences,
} from "./desktop-api"
import { invoke, listen } from "./tauri"
import { timerDisplay, useTimer, type LiveTimer } from "./timer-store"
import type { DesktopPreferences, TimerAction } from "./types"

/**
 * Contents of the always-on-top floating window. Actions are relayed through
 * the main window, which owns (and refreshes) the user session; state arrives
 * here through this window's own SSE stream, so every surface stays in sync.
 */
export function FloatingTimer() {
  const live = useTimer()
  const queryClient = useQueryClient()
  const preferences = usePreferences()
  const compact = preferences.data?.floatingCompact ?? false

  useEffect(() => {
    const off = listen<DesktopPreferences>(DESKTOP_EVENTS.preferences, (prefs) =>
      queryClient.setQueryData(preferencesKey, prefs),
    )
    return () => void off.then((fn) => fn())
  }, [queryClient])

  const toggleCompact = () => {
    void setFloatingCompact(!compact).then((prefs) => queryClient.setQueryData(preferencesKey, prefs))
  }

  return compact ? (
    <CompactView live={live} onExpand={toggleCompact} />
  ) : (
    <FullView live={live} onCompact={toggleCompact} />
  )
}

const send = (action: TimerAction) => {
  const name = action === "toggle" ? "toggleTimer" : action === "reset" ? "resetTimer" : `${action}Timer`
  void invoke("timer_action_via_main", { action: name })
}

function sessionLabel(live: LiveTimer): { text: string; tone: "focus" | "overtime" | "paused" | "idle" } {
  const state = live.state
  if (!state || state.status === "idle" || !state.taskId) return { text: "No active task", tone: "idle" }
  if (!live.isRunning) return { text: "Paused", tone: "paused" }
  if (live.overtimeSeconds > 0) return { text: "Overtime", tone: "overtime" }
  return { text: "Focus", tone: "focus" }
}

const DOT: Record<string, string> = {
  focus: "bg-primary",
  overtime: "bg-destructive",
  paused: "bg-warning",
  idle: "bg-muted-foreground",
}

function StatusDot({ tone, pulse }: { tone: string; pulse: boolean }) {
  return (
    <span className="relative flex size-2.5 shrink-0" aria-hidden="true">
      {pulse && <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 ${DOT[tone]}`} />}
      <span className={`relative inline-flex size-2.5 rounded-full ${DOT[tone]}`} />
    </span>
  )
}

function WindowButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  )
}

function useResetConfirm() {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const id = window.setTimeout(() => setArmed(false), 4000)
    return () => window.clearTimeout(id)
  }, [armed])
  const press = () => {
    if (armed) {
      setArmed(false)
      send("reset")
    } else {
      setArmed(true)
    }
  }
  return { armed, press }
}

function FullView({ live, onCompact }: { live: LiveTimer; onCompact: () => void }) {
  const state = live.state
  const session = sessionLabel(live)
  const display = timerDisplay(live)
  const hasTask = Boolean(state?.taskId) && state?.status !== "idle"
  const planned = state?.plannedSeconds ?? 0
  const pct = planned > 0 ? Math.min(100, (live.spentSeconds / planned) * 100) : 0
  const reset = useResetConfirm()

  return (
    <main className="flex h-screen w-screen select-none flex-col overflow-hidden border border-border bg-card text-foreground">
      <header data-tauri-drag-region className="flex h-9 shrink-0 cursor-grab items-center gap-2 pl-3 pr-1">
        <div className="pointer-events-none flex min-w-0 flex-1 items-center gap-2">
          <StatusDot tone={session.tone} pulse={live.isRunning} />
          <span className="text-xs font-semibold uppercase tracking-wide text-foreground">{session.text}</span>
          {state?.workspaceName && (
            <span className="truncate text-xs text-muted-foreground">{state.workspaceName}</span>
          )}
        </div>
        <WindowButton label="Compact view" onClick={onCompact}>
          <Minimize2 size={14} aria-hidden="true" />
        </WindowButton>
        <WindowButton label="Minimize" onClick={() => void minimizeFloating()}>
          <Minus size={14} aria-hidden="true" />
        </WindowButton>
        <WindowButton label="Close floating timer (the timer keeps running)" onClick={() => void hideFloating()}>
          <X size={14} aria-hidden="true" />
        </WindowButton>
      </header>

      <section data-tauri-drag-region className="flex min-h-0 flex-1 flex-col justify-center px-4" aria-live="polite">
        {live.connection === "unavailable" ? (
          <p className="pointer-events-none text-sm text-destructive">Database unavailable. Reconnect from the dashboard.</p>
        ) : !state ? (
          <p className="pointer-events-none text-sm text-muted-foreground">Connecting to the timer...</p>
        ) : hasTask ? (
          <div className="pointer-events-none flex flex-col gap-0.5">
            <span
              className={`font-mono text-4xl font-semibold leading-none tabular-nums ${display.overtime ? "text-destructive" : "text-foreground"}`}
            >
              {display.value}
            </span>
            <span className="truncate text-sm text-muted-foreground">{state.taskTitle}</span>
          </div>
        ) : (
          <p className="pointer-events-none text-pretty text-sm text-muted-foreground">
            Start a task from the board, then control it from here.
          </p>
        )}
      </section>

      {hasTask && (
        <div className="mx-4 h-1 shrink-0 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div
            className={`h-full rounded-full transition-[width] duration-1000 ${display.overtime ? "bg-destructive" : "bg-primary"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      <footer className="flex shrink-0 items-center gap-2 p-3">
        <button
          type="button"
          onClick={() => send("toggle")}
          disabled={!hasTask}
          className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {live.isRunning ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
          {live.isRunning ? "Pause" : "Start"}
        </button>
        <button
          type="button"
          onClick={reset.press}
          disabled={!live.isRunning}
          className={`flex h-8 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors disabled:opacity-50 ${reset.armed ? "border-destructive text-destructive" : "border-border text-foreground hover:bg-muted"}`}
          aria-label={reset.armed ? "Confirm reset: discards this session's time" : "Reset session"}
          title="Reset discards the time of the current session"
        >
          <RotateCcw size={14} aria-hidden="true" />
          {reset.armed ? "Confirm" : "Reset"}
        </button>
        <button
          type="button"
          onClick={() => void showDashboard()}
          className="grid size-8 place-items-center rounded-lg border border-border text-foreground transition-colors hover:bg-muted"
          aria-label="Open dashboard"
          title="Open dashboard"
        >
          <LayoutDashboard size={14} aria-hidden="true" />
        </button>
      </footer>
    </main>
  )
}

function CompactView({ live, onExpand }: { live: LiveTimer; onExpand: () => void }) {
  const state = live.state
  const session = sessionLabel(live)
  const display = timerDisplay(live)
  const hasTask = Boolean(state?.taskId) && state?.status !== "idle"

  return (
    <main
      data-tauri-drag-region
      className="flex h-screen w-screen cursor-grab select-none items-center gap-2 overflow-hidden border border-border bg-card pl-3 pr-1 text-foreground"
    >
      <div className="pointer-events-none flex min-w-0 flex-1 items-center gap-2">
        <StatusDot tone={session.tone} pulse={live.isRunning} />
        {hasTask ? (
          <>
            <span className={`font-mono text-lg font-semibold tabular-nums ${display.overtime ? "text-destructive" : "text-foreground"}`}>
              {display.value}
            </span>
            <span className="truncate text-xs text-muted-foreground">{state?.taskTitle}</span>
          </>
        ) : (
          <span className="truncate text-xs text-muted-foreground">{session.text}</span>
        )}
      </div>
      <button
        type="button"
        onClick={() => send("toggle")}
        disabled={!hasTask}
        aria-label={live.isRunning ? "Pause timer" : "Start timer"}
        title={live.isRunning ? "Pause" : "Start"}
        className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {live.isRunning ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
      </button>
      <WindowButton label="Expand" onClick={onExpand}>
        <Maximize2 size={14} aria-hidden="true" />
      </WindowButton>
      <WindowButton label="Close floating timer (the timer keeps running)" onClick={() => void hideFloating()}>
        <X size={14} aria-hidden="true" />
      </WindowButton>
    </main>
  )
}
