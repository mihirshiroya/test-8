import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { ChevronLeft, ChevronRight, Lock, Maximize2, Minus, RotateCw, X } from "lucide-react"
import { currentWindow } from "./tauri"

/** Host shown in the read-only address field; the real origin is a random 127.0.0.1 port. */
const DISPLAY_HOST = "notchbuddy.app"

/** macOS keeps its native traffic lights (overlay title bar), so only reserve space for them. */
const IS_MAC = typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent)

const LOCATION_EVENT = "desktop:locationchange"

let historyPatched = false
let maxHistoryIndex = 0

const historyIndex = (): number => (window.history.state?.idx as number | undefined) ?? 0

/**
 * React Router stores a monotonically increasing `idx` in history.state. Watching
 * push/replace/pop lets the title bar know whether back/forward are possible
 * without being rendered inside the router (it also shows on setup screens).
 */
function patchHistory() {
  if (historyPatched) return
  historyPatched = true
  maxHistoryIndex = historyIndex()

  const { pushState, replaceState } = window.history
  window.history.pushState = function (this: History, ...args: Parameters<History["pushState"]>) {
    pushState.apply(this, args)
    maxHistoryIndex = historyIndex()
    window.dispatchEvent(new Event(LOCATION_EVENT))
  }
  window.history.replaceState = function (this: History, ...args: Parameters<History["replaceState"]>) {
    replaceState.apply(this, args)
    maxHistoryIndex = Math.max(maxHistoryIndex, historyIndex())
    window.dispatchEvent(new Event(LOCATION_EVENT))
  }
  window.addEventListener("popstate", () => {
    maxHistoryIndex = Math.max(maxHistoryIndex, historyIndex())
  })
}

function subscribeToLocation(onChange: () => void) {
  patchHistory()
  window.addEventListener("popstate", onChange)
  window.addEventListener(LOCATION_EVENT, onChange)
  return () => {
    window.removeEventListener("popstate", onChange)
    window.removeEventListener(LOCATION_EVENT, onChange)
  }
}

const locationSnapshot = () =>
  `${window.location.pathname}\n${historyIndex()}\n${maxHistoryIndex}`

function useBrowserLocation() {
  const snapshot = useSyncExternalStore(subscribeToLocation, locationSnapshot, locationSnapshot)
  const [pathname, index, max] = snapshot.split("\n")
  return {
    pathname,
    canGoBack: Number(index) > 0,
    canGoForward: Number(index) < Number(max),
  }
}

function useWindowFocused() {
  const [focused, setFocused] = useState(() => document.hasFocus())
  useEffect(() => {
    const onFocus = () => setFocused(true)
    const onBlur = () => setFocused(false)
    window.addEventListener("focus", onFocus)
    window.addEventListener("blur", onBlur)
    return () => {
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("blur", onBlur)
    }
  }, [])
  return focused
}

export function DesktopTitleBar() {
  const { pathname, canGoBack, canGoForward } = useBrowserLocation()
  const focused = useWindowFocused()

  useLayoutEffect(() => {
    const root = document.documentElement
    root.classList.add("has-titlebar")
    return () => root.classList.remove("has-titlebar")
  }, [])

  const address = `${DISPLAY_HOST}${pathname === "/" ? "" : pathname}`

  return createPortal(
    <header
      className="titlebar"
      data-focused={focused}
      data-platform={IS_MAC ? "mac" : "other"}
      data-tauri-drag-region
    >
      <div className="titlebar-side" data-tauri-drag-region>
        {IS_MAC ? <div className="titlebar-native-lights" data-tauri-drag-region /> : <TrafficLights />}

        <nav className="titlebar-nav" aria-label="History">
          <button
            type="button"
            className="titlebar-icon"
            onClick={() => window.history.back()}
            disabled={!canGoBack}
            aria-label="Go back"
          >
            <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="titlebar-icon"
            onClick={() => window.history.forward()}
            disabled={!canGoForward}
            aria-label="Go forward"
          >
            <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </nav>
      </div>

      <div className="titlebar-address">
        <Lock size={11} strokeWidth={2.25} className="titlebar-address-lock" aria-hidden="true" />
        <input
          type="text"
          readOnly
          value={address}
          aria-label="Current page address"
          className="titlebar-address-input"
          spellCheck={false}
          onFocus={(event) => event.currentTarget.select()}
        />
        <button
          type="button"
          className="titlebar-address-reload"
          onClick={() => window.location.reload()}
          aria-label="Reload page"
        >
          <RotateCw size={12} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      <div className="titlebar-side titlebar-side--end" data-tauri-drag-region />
    </header>,
    document.body,
  )
}

function TrafficLights() {
  const win = currentWindow()
  return (
    <div className="titlebar-lights">
      <button
        type="button"
        className="titlebar-light titlebar-light--close"
        onClick={() => void win?.close()}
        aria-label="Close window"
      >
        <X size={8} strokeWidth={3} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="titlebar-light titlebar-light--minimize"
        onClick={() => void win?.minimize()}
        aria-label="Minimize window"
      >
        <Minus size={8} strokeWidth={3} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="titlebar-light titlebar-light--maximize"
        onClick={() => void win?.toggleMaximize()}
        aria-label="Maximize window"
      >
        <Maximize2 size={7} strokeWidth={3} aria-hidden="true" />
      </button>
    </div>
  )
}
