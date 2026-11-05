import { useEffect, useState } from "react"
import { Maximize2, Minus, X } from "lucide-react"
import { currentWindow, errorMessage } from "./tauri"
import { toast } from "../lib/toast"

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

type WindowAction = "close" | "minimize" | "toggleMaximize"

async function runWindowAction(action: WindowAction) {
  const win = currentWindow()
  if (!win) {
    toast.error("Window controls are only available in the desktop app.")
    return
  }
  try {
    await win[action]()
  } catch (error) {
    console.error(`[desktop] window ${action} failed:`, error)
    toast.error(errorMessage(error, "That window action failed."))
  }
}

/** Close / minimize / maximize buttons shown in the app sidebar header. */
export function WindowTrafficLights() {
  const focused = useWindowFocused()

  return (
    <div className="window-controls titlebar-lights" data-focused={focused}>
      <button
        type="button"
        className="titlebar-light titlebar-light--close"
        onClick={() => void runWindowAction("close")}
        aria-label="Close window"
      >
        <X size={8} strokeWidth={3} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="titlebar-light titlebar-light--minimize"
        onClick={() => void runWindowAction("minimize")}
        aria-label="Minimize window"
      >
        <Minus size={8} strokeWidth={3} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="titlebar-light titlebar-light--maximize"
        onClick={() => void runWindowAction("toggleMaximize")}
        aria-label="Maximize window"
      >
        <Maximize2 size={7} strokeWidth={3} aria-hidden="true" />
      </button>
    </div>
  )
}
