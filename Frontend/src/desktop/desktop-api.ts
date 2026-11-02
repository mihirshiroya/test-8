import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { invoke } from "./tauri"
import type { DbCheckResult, DesktopPreferences, DesktopStatus, SavePreferencesResult } from "./types"

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
