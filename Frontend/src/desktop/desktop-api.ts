import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { invoke } from "./tauri"
import type {
  AppInfo,
  DbCheckResult,
  DesktopPreferences,
  DesktopStatus,
  SavePreferencesResult,
  ShortcutIssue,
  TrayStatus,
  UpdateInfo,
} from "./types"

/** Local backend control endpoints (served by Backend/internal/desktop). */
async function control<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  })
  if (!response.ok && response.status !== 400) {
    throw new Error(`Local backend responded with ${response.status}.`)
  }
  return (await response.json()) as T
}

export const fetchDesktopStatus = () => control<DesktopStatus>("/__desktop/status")

export const testDatabase = (url: string) =>
  control<DbCheckResult>("/__desktop/db/test", { method: "POST", body: JSON.stringify({ url }) })

export const setupDatabase = (url: string) =>
  control<DbCheckResult>("/__desktop/db/setup", { method: "POST", body: JSON.stringify({ url }) })

/** Reports whether the configured database currently answers. */
export async function fetchDatabaseHealth(): Promise<{ database: boolean }> {
  try {
    const response = await fetch("/health/ready", { credentials: "include", cache: "no-store" })
    const payload = await response.json().catch(() => null)
    return { database: Boolean(payload?.database) }
  } catch {
    return { database: false }
  }
}

export const desktopStatusKey = ["desktop", "status"] as const
export const preferencesKey = ["desktop", "preferences"] as const

export function useDesktopStatus() {
  return useQuery({
    queryKey: desktopStatusKey,
    queryFn: fetchDesktopStatus,
    retry: 5,
    retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000),
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  })
}

export function usePreferences() {
  return useQuery({
    queryKey: preferencesKey,
    queryFn: () => invoke<DesktopPreferences>("get_preferences"),
    staleTime: Infinity,
  })
}

export function useSavePreferences() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (preferences: DesktopPreferences) =>
      invoke<SavePreferencesResult>("set_preferences", { preferences }),
    onSuccess: (result) => queryClient.setQueryData(preferencesKey, result.preferences),
  })
}

/** Stores the URL in the OS credential store and restarts the backend with it. */
export const saveDatabaseUrl = (url: string) => invoke<void>("save_database_url", { url })
export const forgetDatabaseUrl = () => invoke<void>("forget_database_url")
export const restartBackend = () => invoke<void>("restart_backend")

export const updateTray = (status: TrayStatus) => invoke<void>("update_tray", { status })
export const notify = (title: string, body: string) => invoke<void>("notify", { title, body })

export const showFloating = () => invoke<void>("show_floating")
export const hideFloating = () => invoke<void>("hide_floating")
export const toggleFloating = () => invoke<boolean>("toggle_floating")
export const isFloatingVisible = () => invoke<boolean>("is_floating_visible")
export const minimizeFloating = () => invoke<void>("minimize_floating")
export const setFloatingCompact = (compact: boolean) =>
  invoke<DesktopPreferences>("set_floating_compact", { compact })
export const showDashboard = (path?: string) => invoke<void>("show_dashboard", { path: path ?? null })

/** Data the main window hands to the system-wide "Still focusing?" window. */
export interface CheckinPayload {
  taskId: string
  taskTitle: string
  workspaceLabel: string
  /** Seconds spent when the payload was sent; the overlay keeps counting from `sentAt`. */
  spentSeconds: number
  sentAt: number
  /** Epoch ms when the task is auto-paused. */
  deadline: number
}

/** "timeout" is sent by the prompt window when its countdown reaches zero. */
export type CheckinAnswer = "continue" | "pause" | "timeout"

/** Shows the prompt natively at `fireAt` (epoch ms), even if this webview is throttled. */
export const scheduleCheckin = (payload: CheckinPayload, fireAt: number) =>
  invoke<void>("schedule_checkin", { payload, fireAt: Math.round(fireAt) })
export const cancelCheckin = () => invoke<void>("cancel_checkin")

export const showCheckin = (payload: CheckinPayload) => invoke<void>("show_checkin", { payload })
export const hideCheckin = () => invoke<void>("hide_checkin")
export const getCheckin = () => invoke<CheckinPayload | null>("get_checkin")
export interface CheckinResponse {
  taskId: string
  action: CheckinAnswer
}

export const answerCheckin = (action: CheckinAnswer, taskId: string, deadline: number) =>
  invoke<void>("checkin_response", { action, taskId, deadline })

export const getShortcutIssues = () => invoke<ShortcutIssue[]>("get_shortcut_issues")
export const exportPreferences = () => invoke<string | null>("export_preferences")
export const importPreferences = () => invoke<SavePreferencesResult | null>("import_preferences")

export const getAutostart = () => invoke<boolean>("get_autostart")
export const setAutostart = (enabled: boolean) => invoke<boolean>("set_autostart", { enabled })
export const getAppInfo = () => invoke<AppInfo>("app_info")
export const checkForUpdate = () => invoke<UpdateInfo | null>("check_update")
export const installUpdate = () => invoke<void>("install_update")
export const quitApp = () => invoke<void>("quit_app")

export const DESKTOP_EVENTS = {
  action: "desktop://action",
  navigate: "desktop://navigate",
  preferences: "desktop://preferences",
  floatingVisibility: "desktop://floating-visibility",
  backendRestarted: "desktop://backend-restarted",
  backendExited: "desktop://backend-exited",
  checkin: "desktop://checkin",
  checkinResponse: "desktop://checkin-response",
} as const
