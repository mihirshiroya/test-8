export type TimerStatus = "idle" | "running" | "paused"
export type SessionType = "focus" | "overtime" | "none"

/** Mirrors timerState in Backend/internal/api/timer.go. */
export interface TimerState {
  status: TimerStatus
  sessionType: SessionType
  taskId: string | null
  taskTitle: string
  workspaceId: string | null
  workspaceName: string
  plannedSeconds: number
  spentSeconds: number
  remainingSeconds: number
  sessionStartedAt: number | null
  serverTime: number
}

export type TimerAction = "start" | "pause" | "toggle" | "reset"

export type DesktopMode = "ready" | "setup" | "error"

/** Mirrors desktop.CheckResult in Backend/internal/desktop/setup.go. */
export interface DbCheckResult {
  ok: boolean
  code?: string
  message: string
  serverVersion?: string
  database?: string
}

export interface DesktopStatus {
  mode: DesktopMode
  version: string
  databaseConfigured: boolean
  serverTime: number
  error?: DbCheckResult
}

export type ShortcutAction = "toggleTimer" | "resetTimer" | "toggleFloating" | "showDashboard"

/** Mirrors Preferences in Frontend/src-tauri/src/preferences.rs. */
export interface DesktopPreferences {
  closeToTray: boolean
  startMinimized: boolean
  showFloatingOnStartup: boolean
  floatingCompact: boolean
  notificationsEnabled: boolean
  shortcuts: Record<ShortcutAction, string>
}

export interface ShortcutIssue {
  action: ShortcutAction
  accelerator: string
  message: string
}

export interface SavePreferencesResult {
  preferences: DesktopPreferences
  shortcutIssues: ShortcutIssue[]
}

export interface UpdateInfo {
  version: string
  currentVersion: string
  notes: string | null
  date: string | null
}
