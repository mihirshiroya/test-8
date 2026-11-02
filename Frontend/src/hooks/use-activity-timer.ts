import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CHECK_INTERVAL_MS, IDLE_THRESHOLD_MS, RESPONSE_WINDOW_MS, activeSession, commitToDaily, dayKey, loadDailyRecord, loadLive, saveDailyRecord, saveLive, clearLive, sessionActiveMs, stateAfterCheck, stateAfterConfirm, stateAfterPause, stateAfterResume, stateAfterStart, stateAfterStop, stateAfterTimeout, type DailyRecord, type LiveRecord, type SessionRecord, type TimerStatus } from '../helpers/activity-timer'

type TimerWorker = Worker & { onmessage: ((event: MessageEvent) => void) | null }

function createScheduler(onTick: () => void) {
  let worker: TimerWorker | null = null
  let timeoutId: number | null = null
  let stopped = false

  const scheduleFallback = () => {
    if (stopped) return
    const delay = Math.max(100, 1000 - (Date.now() % 1000))
    timeoutId = window.setTimeout(() => { onTick(); scheduleFallback() }, delay)
  }

  try {
    const source = `let id=null; self.onmessage=e=>{ if(e.data==='start'){ clearInterval(id); id=setInterval(()=>self.postMessage('tick'),1000) } if(e.data==='stop'){ clearInterval(id); id=null } }`
    worker = new Worker(URL.createObjectURL(new Blob([source], { type: 'application/javascript' }))) as TimerWorker
    worker.onmessage = () => onTick()
    worker.postMessage('start')
  } catch {
    scheduleFallback()
  }

  return () => {
    stopped = true
    if (timeoutId != null) window.clearTimeout(timeoutId)
    worker?.postMessage('stop')
    worker?.terminate()
  }
}

export function useActivityTimer({
  userId,
  // Pass `true` only while a task is IN_PROGRESS. When false, nothing runs:
  // no worker, no listeners, no ticks, and any live session is committed + reset.
  enabled = true,
  checkIntervalMs = CHECK_INTERVAL_MS,
  responseWindowMs = RESPONSE_WINDOW_MS,
}: { userId: string; enabled?: boolean; checkIntervalMs?: number; responseWindowMs?: number }) {
  const [internal, setInternal] = useState<LiveRecord>(() => ({ version: 1, status: 'idle', accumulatedMs: 0, segmentStart: null, nextCheckAtMs: checkIntervalMs, checkDeadline: null, sessionStartClock: null, savedAt: Date.now(), checkIntervalMs, responseWindowMs }))
  const [daily, setDaily] = useState<DailyRecord>({ date: dayKey(), dailyTotalMs: 0, sessions: [] })
  const [, tick] = useState(0)
  const [isIdle, setIsIdle] = useState(false)
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden)
  const stateRef = useRef(internal); stateRef.current = internal
  const dailyRef = useRef(daily); dailyRef.current = daily
  const activityRef = useRef(Date.now())

  const persist = useCallback((next: LiveRecord) => { const stamped = { ...next, savedAt: Date.now() }; stateRef.current = stamped; setInternal(stamped); saveLive(userId, stamped) }, [userId])
  const persistDaily = useCallback((next: DailyRecord) => { dailyRef.current = next; setDaily(next); saveDailyRecord(userId, next) }, [userId])
  const today = useCallback(() => dailyRef.current.date === dayKey() ? dailyRef.current : { date: dayKey(), dailyTotalMs: 0, sessions: [] }, [])
  const commit = useCallback((state: LiveRecord, now: number) => { const session = activeSession(state, now); if (!session) return; const next = commitToDaily(today(), session); if (next !== dailyRef.current) persistDaily(next) }, [persistDaily, today])

  // Commit whatever is live and go back to a clean idle state.
  const resetToIdle = useCallback(() => {
    const s = stateRef.current
    commit(s, Date.now())
    const next = stateAfterStop(checkIntervalMs, responseWindowMs)
    stateRef.current = next
    setInternal(next)
    setIsIdle(false)
    clearLive(userId)
  }, [checkIntervalMs, responseWindowMs, commit, userId])

  // Load / recover persisted state
  useEffect(() => {
    const loaded = loadDailyRecord(userId); setDaily(loaded); dailyRef.current = loaded
    const saved = loadLive(userId)
    if (saved && saved.version === 1 && saved.checkIntervalMs === checkIntervalMs && saved.responseWindowMs === responseWindowMs) {
      const now = Date.now(); let recovered = saved
      if (saved.status === 'checking' && saved.checkDeadline != null && now >= saved.checkDeadline) { commit(saved, now); recovered = stateAfterTimeout(saved) }
      setInternal(recovered); stateRef.current = recovered
    } else clearLive(userId)
  }, [userId, checkIntervalMs, responseWindowMs, commit])

  // No task in progress -> shut everything down (declared after the load effect
  // so a recovered session is committed on the same mount).
  useEffect(() => {
    if (enabled) return
    if (stateRef.current.status === 'idle') return
    resetToIdle()
  }, [enabled, resetToIdle])

  const start = useCallback(() => {
    if (!enabled) return
    persist(stateAfterStart(Date.now(), checkIntervalMs, responseWindowMs))
  }, [enabled, checkIntervalMs, responseWindowMs, persist])
  const pause = useCallback(() => { const s = stateRef.current; if (s.status === 'running') persist(stateAfterPause(s, Date.now())) }, [persist])
  const resume = useCallback(() => { const s = stateRef.current; if (enabled && s.status === 'paused') { activityRef.current = Date.now(); setIsIdle(false); persist(stateAfterResume(s, Date.now())) } }, [enabled, persist])
  const stop = useCallback(() => resetToIdle(), [resetToIdle])
  const confirmActive = useCallback(() => { const s = stateRef.current; if (s.status === 'checking') { activityRef.current = Date.now(); setIsIdle(false); persist(stateAfterConfirm(s, Date.now(), checkIntervalMs)) } }, [checkIntervalMs, persist])
  const finishFromCheck = useCallback(() => { const s = stateRef.current; if (s.status === 'checking') resetToIdle() }, [resetToIdle])

  // Activity listeners: only while enabled AND the session is actually running
  useEffect(() => {
    if (!enabled || internal.status !== 'running') return
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'] as const
    const mark = () => { activityRef.current = Date.now(); setIsIdle(v => v ? false : v) }
    events.forEach(e => window.addEventListener(e, mark, { passive: true }))
    return () => events.forEach(e => window.removeEventListener(e, mark))
  }, [enabled, internal.status])

  // Single scheduler: only while enabled, running/checking and the tab is visible
  useEffect(() => {
    if (!enabled || !['running', 'checking'].includes(internal.status) || hidden) return
    const evaluate = () => {
      if (document.hidden) return
      const now = Date.now(); const s = stateRef.current
      if (s.status === 'running') {
        setIsIdle(now - activityRef.current > IDLE_THRESHOLD_MS)
        if (sessionActiveMs(s, now) >= s.nextCheckAtMs) persist(stateAfterCheck(s, now, responseWindowMs))
      } else if (s.status === 'checking' && s.checkDeadline != null && now >= s.checkDeadline) { commit(s, now); persist(stateAfterTimeout(s)) }
      tick(v => (v + 1) % 100000)
    }
    return createScheduler(evaluate)
  }, [enabled, internal.status, hidden, responseWindowMs, persist, commit])

  useEffect(() => {
    const onVisibility = () => {
      setHidden(document.hidden)
      if (!document.hidden) {
        const s = stateRef.current; const now = Date.now()
        if (s.status === 'checking' && s.checkDeadline != null && now >= s.checkDeadline) { commit(s, now); persist(stateAfterTimeout(s)) }
        tick(v => (v + 1) % 100000)
      }
      const s = stateRef.current; if (s.status !== 'idle') saveLive(userId, { ...s, savedAt: Date.now() })
    }
    const save = () => { const s = stateRef.current; if (s.status !== 'idle') saveLive(userId, { ...s, savedAt: Date.now() }) }
    document.addEventListener('visibilitychange', onVisibility); window.addEventListener('pagehide', save)
    return () => { document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('pagehide', save) }
  }, [userId, commit, persist])

  const now = Date.now()
  return useMemo(() => {
    const sessionMs = sessionActiveMs(internal, now)
    const dailyMs = ['idle', 'timedout'].includes(internal.status) ? daily.dailyTotalMs : daily.dailyTotalMs + sessionMs
    return { status: internal.status as TimerStatus, sessionMs, dailyMs, sessions: daily.sessions as SessionRecord[], isIdle: internal.status === 'running' && isIdle, responseRemainingMs: internal.status === 'checking' && internal.checkDeadline ? Math.max(0, internal.checkDeadline - now) : 0, untilNextCheckMs: Math.max(0, internal.nextCheckAtMs - sessionMs), responseWindowMs, checkIntervalMs, enabled, start, pause, resume, stop, confirmActive, finishFromCheck }
  }, [internal, daily, isIdle, enabled, responseWindowMs, checkIntervalMs, start, pause, resume, stop, confirmActive, finishFromCheck, now])
}