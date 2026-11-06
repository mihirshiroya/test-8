import { useCallback, useEffect, useRef, useState } from "react"
import { CheckinCard } from "../components/Ui/checkin-card"
import { answerCheckin, DESKTOP_EVENTS, getCheckin, type CheckinAnswer, type CheckinPayload } from "./desktop-api"
import { errorMessage, listen } from "./tauri"
import { useSharedTheme } from "./use-shared-theme"

export const CHECKIN_ROUTE = "/checkin"

/**
 * Contents of the always-on-top "Still focusing?" window that appears on the
 * left edge of the screen, above whatever app the user is working in. The
 * main window owns the timer; answers are relayed back to it.
 */
export default function CheckinApp() {
  useSharedTheme()
  const [payload, setPayload] = useState<CheckinPayload | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState<string | null>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const submitting = useRef(false)
  const timedOut = useRef<string | null>(null)

  useEffect(() => {
    document.title = "Still focusing?"
    let disposed = false
    let revision = 0
    let unlisten: (() => void) | undefined
    const receive = (current: CheckinPayload | null) => {
      if (disposed) return
      revision += 1
      setNow(Date.now())
      setError(null)
      setPayload(current)
    }
    // Subscribe before reading the snapshot, otherwise a reused/preloaded
    // window can miss a show/hide event during startup.
    void listen<CheckinPayload | null>(DESKTOP_EVENTS.checkin, receive)
      .then(async (off) => {
        if (disposed) { off(); return }
        unlisten = off
        const atRead = revision
        const current = await getCheckin()
        if (revision === atRead) receive(current)
      })
      .catch((cause) => {
        if (!disposed) setError(errorMessage(cause, "Could not load the check-in."))
      })
    return () => {
      disposed = true
      unlisten?.()
    }
  }, [])

  useEffect(() => {
    if (!payload) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [payload])

  const answer = useCallback(async (action: CheckinAnswer) => {
    if (!payload || submitting.current) return
    submitting.current = true
    setError(null)
    try {
      await answerCheckin(action, payload.taskId, payload.deadline)
    } catch (cause) {
      setError(errorMessage(cause, "Could not send your response. Please try again."))
    } finally {
      submitting.current = false
    }
  }, [payload])

  useEffect(() => {
    if (!payload) return
    // Focus the button only once the user activates this window; do not
    // interrupt typing in the foreground application when the prompt appears.
    const onFocus = () => primaryRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") void answer("continue")
    }
    window.addEventListener("focus", onFocus)
    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [payload, answer])

  const secondsLeft = payload ? Math.max(0, Math.ceil((payload.deadline - now) / 1000)) : null

  // Also report expiration from the visible overlay, in case the main
  // webview's JavaScript timers have been suspended by the OS.
  useEffect(() => {
    if (!payload || secondsLeft !== 0) return
    const key = `${payload.taskId}:${payload.deadline}`
    if (timedOut.current === key) return
    timedOut.current = key
    void answer("timeout")
  }, [payload, secondsLeft, answer])

  if (!payload || secondsLeft === null) return error ? <p role="alert">{error}</p> : null

  const spentSeconds = payload.spentSeconds + Math.max(0, Math.floor((now - payload.sentAt) / 1000))

  return (
    <main className="flex h-screen w-screen flex-col overflow-y-auto bg-canvas">
      <CheckinCard
        draggable
        className="min-h-full shrink-0"
        workspaceLabel={payload.workspaceLabel}
        taskTitle={payload.taskTitle}
        spentSeconds={spentSeconds}
        secondsLeft={secondsLeft}
        primaryRef={primaryRef}
        onContinue={() => void answer("continue")}
        onPause={() => void answer("pause")}
      />
      {error && <p role="alert" className="px-6 pb-4 text-sm text-destructive">{error}</p>}
    </main>
  )
}
