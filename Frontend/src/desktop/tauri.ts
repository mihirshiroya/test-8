/**
 * Thin wrapper over the `window.__TAURI__` global (enabled with
 * `app.withGlobalTauri`). Using the global instead of @tauri-apps/api keeps
 * the web build free of desktop dependencies; every call is a no-op or a clear
 * error outside the desktop app.
 */

type Unlisten = () => void

interface TauriWindowHandle {
  label: string
  minimize(): Promise<void>
  hide(): Promise<void>
}

interface TauriGlobal {
  core: {
    invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>
  }
  event: {
    listen<T>(event: string, handler: (event: { payload: T }) => void): Promise<Unlisten>
  }
  window: {
    getCurrentWindow(): TauriWindowHandle
  }
}

declare global {
  interface Window {
    __TAURI__?: TauriGlobal
  }
}

const tauri = (): TauriGlobal | null =>
  typeof window === "undefined" ? null : window.__TAURI__ ?? null

export const isTauri = () => tauri() !== null

export function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const t = tauri()
  if (!t) {
    return Promise.reject(new Error("This action is only available in the desktop app."))
  }
  return t.core.invoke<T>(command, args)
}

export async function listen<T>(event: string, handler: (payload: T) => void): Promise<Unlisten> {
  const t = tauri()
  if (!t) return () => {}
  return t.event.listen<T>(event, (e) => handler(e.payload))
}

export function currentWindowLabel(): string | null {
  return tauri()?.window.getCurrentWindow().label ?? null
}

export function currentWindow(): TauriWindowHandle | null {
  return tauri()?.window.getCurrentWindow() ?? null
}

/** Tauri rejects invoke() with a plain string; normalise to a message. */
export function errorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (typeof error === "string") return error
  if (error instanceof Error) return error.message
  return fallback
}
