"use client"

import { useEffect, useRef, useState } from "react"

import { CheckinCard } from "./checkin-card"
import { AppDialog, AppDialogButton } from "./app-dialog"
import {
  useTaskStore,
  taskSpentSeconds,
  CHECK_INTERVAL_MS,
  RESPONSE_WINDOW_MS,
} from "../../store/slices/taskSlice"
import { IS_DESKTOP } from "../../lib/api-origin"
import {
  DESKTOP_EVENTS,
  cancelCheckin,
  scheduleCheckin,
  showCheckin,
    type CheckinResponse,
} from "../../desktop/desktop-api"
import { isTauri, listen } from "../../desktop/tauri"

/**
 * NOTE ON MIGRATION:
 *
 * The old TimerState had a dedicated "checking" phase with a hard
 * `checkDeadline` timestamp, which powered the circular countdown you'd
 * see here. The new TimerState doesn't track a check-in deadline at all —
 * `timerTick` just flips `isStale` to true if too much time passed since
 * the timer was last confirmed as running (e.g. the tab was backgrounded
 * or the machine slept). Because there's no deadline to count down to
 * anymore, this dialog now shows as soon as the timer goes stale, with no
 * countdown — the person can confirm they're still working or pause.
 *
 * In the desktop app the prompt is shown in its own always-on-top window on
 * the left edge of the screen, so it is visible over any other app. The
 * in-app dialog is only used on the web or if that window can't open.
 */
const USE_SYSTEM_OVERLAY = IS_DESKTOP && isTauri()

export function ActivityDialog() {
  const { timer, tasks, workspaces, confirmActive, holdTask } = useTaskStore()
  const [overlayFailed, setOverlayFailed] = useState(false)

  const open = timer.phase === "running" && timer.isStale && !!timer.taskId

  const task = tasks.find((t) => t.id === timer.taskId)
  const workspace = task ? workspaces.find((w) => w.id === task.workspaceId) : undefined
  const workspaceLabel = workspace?.name ?? "Workspace"
  const showOverlay = USE_SYSTEM_OVERLAY && !overlayFailed

  // Keep the latest values reachable from effects without re-running them every tick.
  const latest = useRef({ task, timer, confirmActive, holdTask })
  latest.current = { task, timer, confirmActive, holdTask }

  const deadline = timer.checkDeadline ?? null
  const running = timer.phase === "running"
  const isStale = timer.isStale
  const lastCheckTime = timer.lastCheckTime
  const taskId = task?.id
  const taskTitle = task?.title

  // The OS throttles hidden webviews, so the next check-in is handed to the
  // native side ahead of time; it shows the prompt over whatever app is in
  // front even if this window's timers are paused.
  useEffect(() => {
    if (!showOverlay) return
    const current = latest.current
    if (!running || !current.task || !taskId || !taskTitle) {
      void cancelCheckin().catch(() => {})
      return
    }
    const now = Date.now()
    const base = {
      taskId,
      taskTitle,
      workspaceLabel,
      spentSeconds: taskSpentSeconds(current.task, current.timer),
      sentAt: now,
    }
    if (isStale) {
      showCheckin({ ...base, deadline: deadline ?? now + RESPONSE_WINDOW_MS }).catch(() =>
        setOverlayFailed(true),
      )
      return
    }
    const fireAt = (lastCheckTime ?? now) + CHECK_INTERVAL_MS
    scheduleCheckin({ ...base, deadline: fireAt + RESPONSE_WINDOW_MS }, fireAt).catch(() =>
      setOverlayFailed(true),
    )
  }, [showOverlay, running, isStale, lastCheckTime, taskId, taskTitle, workspaceLabel, deadline])

  useEffect(() => {
    if (!USE_SYSTEM_OVERLAY) return
    const off = listen<CheckinResponse>(DESKTOP_EVENTS.checkinResponse, ({ taskId, action }) => {
      const { task: current, timer: t, confirmActive: confirm, holdTask: hold } = latest.current
      if (!current || t.phase !== "running" || t.taskId !== taskId || current.id !== taskId) return
      if (action === "continue") confirm(current.id)
      else if (action === "pause" || action === "timeout") hold(current.id)
    })
    return () => {
      void off.then((fn) => fn())
      void cancelCheckin().catch(() => {})
    }
  }, [])

  const inAppOpen = open && !showOverlay

  if (!inAppOpen || !task) {
    return null
  }

  const spent = taskSpentSeconds(task, timer)

  const secondsLeft = Math.max(
    0,
    Math.ceil(((timer.checkDeadline ?? Date.now()) - (timer.now || Date.now())) / 1000)
  )

  const dismiss = () => confirmActive(task.id)

  return (
    <AppDialog
      open
      title="Still focusing?"
      description="If you don't respond, this task will be moved to On Hold automatically."
      onClose={dismiss}
      footer={<>
        <AppDialogButton variant="secondary" onClick={() => holdTask(task.id)}>Pause it</AppDialogButton>
        <AppDialogButton autoFocus onClick={dismiss}>Yes, continue</AppDialogButton>
      </>}
    >
      <CheckinCard
        embedded
        workspaceLabel={workspaceLabel}
        taskTitle={task.title}
        spentSeconds={spent}
        secondsLeft={secondsLeft}
        onContinue={dismiss}
        onPause={() => holdTask(task.id)}
      />
    </AppDialog>
  )
}
