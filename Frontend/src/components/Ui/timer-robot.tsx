"use client"

import { useActiveTask, useTaskStore } from "../../store/slices/taskSlice"
import type { TimerPhase } from "../../store/slices/taskSlice"
import { RobotHead, useRobotPresence, type RobotState } from "./robot-head"

export const ROBOT_COLOR: Record<RobotState, string> = {
  idle: "#8b8f98",
  sleeping: "#6b7280",
  active: "#22c55e",
  thinking: "#f59e0b",
  listening: "#8b5cf6",
  surprised: "#f97316",
  happy: "#facc15",
  error: "#ef4444",
}

/** Maps the focus timer's live state to a robot mood. */
export function getTimerRobotState({
  hasTask,
  phase,
  isStale,
  remaining,
  planned,
}: {
  hasTask: boolean
  phase: TimerPhase
  isStale: boolean
  remaining: number
  planned: number
}): RobotState {
  if (!hasTask || phase === "stopped") return "sleeping"
  if (isStale) return "listening"
  if (phase === "paused") return "idle"
  if (planned > 0 && remaining <= 0) return "happy"
  if (planned > 0 && remaining <= Math.min(60, planned * 0.1)) return "surprised"
  if (planned > 0 && remaining <= planned * 0.25) return "thinking"
  return "active"
}

export function useTimerRobotState(): RobotState {
  const { hasActiveTask } = useTaskStore()
  const { activeTask, timer, remainingSeconds: remaining } = useActiveTask()

  return useRobotPresence(
    getTimerRobotState({
      hasTask: hasActiveTask && Boolean(activeTask),
      phase: timer.phase,
      isStale: timer.isStale,
      remaining,
      planned: activeTask?.plannedDurationSeconds ?? 0,
    }),
    !hasActiveTask || timer.phase === "stopped",
    20000
  )
}

export function TimerRobot({ size = 48 }: { size?: number }) {
  const state = useTimerRobotState()

  return (
    <RobotHead
      state={state}
      size={size}
      color={ROBOT_COLOR[state]}
      className="shrink-0"
    />
  )
}
