"use client"

import { useTaskTimerEngine } from "../store/slices/taskSlice.tsx"

/**
 * Runs the Redux timer engine (check-in transitions, timeouts,
 * auto-completion). Renders nothing — mount this ONCE near the app root,
 * inside your <Provider store={store}>. Do not call useTaskTimerEngine()
 * from any other component, or you'll get duplicate intervals.
 */
export default function TaskTimerEngine() {
  useTaskTimerEngine()
  return null
}