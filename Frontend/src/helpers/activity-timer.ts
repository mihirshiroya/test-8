export const CHECK_INTERVAL_MS =  60 * 1000
export const RESPONSE_WINDOW_MS = 30 * 1000
export const IDLE_THRESHOLD_MS =  60 * 1000

export type TimerStatus = 'idle' | 'running' | 'paused' | 'checking' | 'timedout'
export interface SessionRecord { start: number; end: number; durationMs: number }
export interface DailyRecord { date: string; dailyTotalMs: number; sessions: SessionRecord[] }

const dailyKey = (userId: string) => `activity-timer:daily:${encodeURIComponent(userId)}`
export const liveKey = (userId: string) => `activity-timer:live:${encodeURIComponent(userId)}`
export const dayKey = (date = new Date()) => {
  const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(total / 3600); const m = Math.floor((total % 3600) / 60); const s = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
export function formatClock(timestamp: number) { return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }

function storage() { try { return typeof window === 'undefined' ? null : window.localStorage } catch { return null } }
export function loadDailyRecord(userId: string): DailyRecord {
  const fallback = { date: dayKey(), dailyTotalMs: 0, sessions: [] }
  try { const raw = storage()?.getItem(dailyKey(userId)); if (!raw) return fallback; const parsed = JSON.parse(raw); if (parsed?.date && Array.isArray(parsed.sessions)) return parsed; return fallback } catch { return fallback }
}
export function saveDailyRecord(userId: string, record: DailyRecord) { try { storage()?.setItem(dailyKey(userId), JSON.stringify(record)) } catch {} }
export function clearLiveRecord(userId: string) { try { storage()?.removeItem(liveKey(userId)) } catch {} }
export function loadLiveRecord(userId: string): unknown { try { const raw = storage()?.getItem(liveKey(userId)); return raw ? JSON.parse(raw) : null } catch { return null } }
export function saveLiveRecord(userId: string, record: unknown) { try { storage()?.setItem(liveKey(userId), JSON.stringify(record)) } catch {} }

export function isValidLiveRecord(value: any, interval: number, window: number) {
  return value && value.version === 1 && ['running','paused','checking','timedout','idle'].includes(value.status) && Number.isFinite(value.accumulatedMs) && value.accumulatedMs >= 0 && Number.isFinite(value.nextCheckAtMs) && (value.segmentStart === null || Number.isFinite(value.segmentStart)) && (value.checkDeadline === null || Number.isFinite(value.checkDeadline)) && (value.sessionStartClock === null || Number.isFinite(value.sessionStartClock)) && value.checkIntervalMs === interval && value.responseWindowMs === window
}
export type LiveRecord = { version: 1; status: TimerStatus; accumulatedMs: number; segmentStart: number | null; nextCheckAtMs: number; checkDeadline: number | null; sessionStartClock: number | null; savedAt: number; checkIntervalMs: number; responseWindowMs: number }

export function persistable(state: Omit<LiveRecord, 'version' | 'savedAt' | 'checkIntervalMs' | 'responseWindowMs'>, now: number, interval: number, window: number): LiveRecord { return { ...state, version: 1, savedAt: now, checkIntervalMs: interval, responseWindowMs: window } }
export function sessionActiveMs(s: Pick<LiveRecord, 'accumulatedMs' | 'segmentStart'>, now: number) { return Math.max(0, s.accumulatedMs + (s.segmentStart == null ? 0 : now - s.segmentStart)) }
function safeDuration(ms: number) { return Math.max(0, ms) }
export function clampRecord(record: DailyRecord): DailyRecord { return { ...record, dailyTotalMs: safeDuration(record.dailyTotalMs), sessions: record.sessions.filter(s => Number.isFinite(s.start) && Number.isFinite(s.end) && Number.isFinite(s.durationMs) && s.durationMs >= 0) } }
export const MAX_CLOCK_JUMP_MS = 24 * 60 * 60 * 1000
export function normalizeNow(now: number, savedAt: number) { return now < savedAt || now - savedAt > MAX_CLOCK_JUMP_MS ? savedAt : now }

export const storageKeys = { daily: dailyKey, live: liveKey }

export function uniqueSession(record: DailyRecord, session: SessionRecord) { return record.sessions.some(s => s.start === session.start && s.end === session.end) }

export function commitToDaily(record: DailyRecord, session: SessionRecord): DailyRecord {
  if (session.durationMs < 1000 || uniqueSession(record, session)) return record
  return { ...record, dailyTotalMs: record.dailyTotalMs + session.durationMs, sessions: [...record.sessions, session] }
}

export function activeSession(s: { accumulatedMs: number; segmentStart: number | null; sessionStartClock: number | null }, now: number): SessionRecord | null { const duration = sessionActiveMs(s, now); return s.sessionStartClock == null || duration < 1000 ? null : { start: s.sessionStartClock, end: now, durationMs: duration } }

export function clearLive(userId: string) { clearLiveRecord(userId) }
export function parseLive(value: unknown): LiveRecord | null { return value as LiveRecord | null }
export function todayRecord(userId: string) { const record = clampRecord(loadDailyRecord(userId)); return record.date === dayKey() ? record : { date: dayKey(), dailyTotalMs: 0, sessions: [] } }
export function saveTodayRecord(userId: string, record: DailyRecord) { saveDailyRecord(userId, record) }
export function saveLive(userId: string, state: LiveRecord) { saveLiveRecord(userId, state) }
export function loadLive(userId: string) { return loadLiveRecord(userId) as LiveRecord | null }
export function resetLive(userId: string) { clearLiveRecord(userId) }
export function activeMs(s: LiveRecord, now: number) { return sessionActiveMs(s, now) }
export function commitSessionOnce(userId: string, now: number, state: LiveRecord) { const record = todayRecord(userId); const session = activeSession(state, now); if (session) saveTodayRecord(userId, commitToDaily(record, session)); return session }
export function initialState(interval: number): LiveRecord { return { version: 1, status: 'idle', accumulatedMs: 0, segmentStart: null, nextCheckAtMs: interval, checkDeadline: null, sessionStartClock: null, savedAt: Date.now(), checkIntervalMs: interval, responseWindowMs: RESPONSE_WINDOW_MS } }
export function serializeState(state: LiveRecord, now: number, interval: number, window: number) { return persistable(state, now, interval, window) }
export function restoreState(raw: unknown, interval: number, window: number) { return isValidLiveRecord(raw, interval, window) ? raw as LiveRecord : null }
export function isCurrentDay(record: DailyRecord) { return record.date === dayKey() }
export function rollover(record: DailyRecord) { return isCurrentDay(record) ? record : { date: dayKey(), dailyTotalMs: 0, sessions: [] } }
export function safeSave(fn: () => void) { try { fn() } catch {} }
export function getStorage() { return storage() }
export function liveStorageKey(userId: string) { return liveKey(userId) }
export function dailyStorageKey(userId: string) { return dailyKey(userId) }
export function elapsedSince(savedAt: number, now: number) { return normalizeNow(now, savedAt) - savedAt }
export function toSession(state: LiveRecord, now: number) { return activeSession(state, now) }
export function mergeSession(record: DailyRecord, state: LiveRecord, now: number) { const s = toSession(state, now); return s ? commitToDaily(record, s) : record }
export function hasSession(record: DailyRecord, state: LiveRecord, now: number) { const s = toSession(state, now); return !!s && uniqueSession(record, s) }
export function clearOnReset(userId: string) { clearLiveRecord(userId) }
export function versioned(state: LiveRecord) { return state.version === 1 }
export function isRunning(state: LiveRecord) { return state.status === 'running' }
export function isChecking(state: LiveRecord) { return state.status === 'checking' }
export function isPaused(state: LiveRecord) { return state.status === 'paused' }
export function isTerminal(state: LiveRecord) { return state.status === 'idle' || state.status === 'timedout' }
export function deadlineExpired(state: LiveRecord, now: number) { return state.status === 'checking' && state.checkDeadline != null && now >= state.checkDeadline }
export function checkDue(state: LiveRecord, now: number) { return state.status === 'running' && sessionActiveMs(state, now) >= state.nextCheckAtMs }
export function boundedInterval(value: number, fallback: number) { return Number.isFinite(value) && value > 0 ? value : fallback }
export function boundedWindow(value: number, fallback: number) { return Number.isFinite(value) && value > 0 ? value : fallback }
export function dayBoundary(record: DailyRecord) { return record.date !== dayKey() }
export function resetRecord() { return { date: dayKey(), dailyTotalMs: 0, sessions: [] } as DailyRecord }
export function cloneRecord(record: DailyRecord) { return JSON.parse(JSON.stringify(record)) as DailyRecord }
export function nowMs() { return Date.now() }
export function canPersist() { return storage() != null }
export function storageAvailable() { return canPersist() }
export function liveSnapshot(userId: string) { return loadLive(userId) }
export function dailySnapshot(userId: string) { return loadDailyRecord(userId) }
export function writeLive(userId: string, state: LiveRecord) { saveLive(userId, state) }
export function writeDaily(userId: string, record: DailyRecord) { saveTodayRecord(userId, record) }
export function removeLive(userId: string) { resetLive(userId) }
export function sessionDuration(state: LiveRecord, now: number) { return sessionActiveMs(state, now) }
export function statusLabel(status: TimerStatus) { return status }
export function sanitizeRecord(record: DailyRecord) { return clampRecord(record) }
export function createSession(state: LiveRecord, now: number) { return activeSession(state, now) }
export function appendSession(record: DailyRecord, session: SessionRecord) { return commitToDaily(record, session) }
export function safeNow(now: number) { return Number.isFinite(now) ? now : Date.now() }
export function nextThreshold(state: LiveRecord) { return state.nextCheckAtMs }
export function responseDeadline(state: LiveRecord) { return state.checkDeadline }
export function snapshotVersion() { return 1 }
export function sameUserKey(userId: string) { return encodeURIComponent(userId) }
export function isMalformed(raw: unknown, interval: number, window: number) { return !isValidLiveRecord(raw, interval, window) }
export function noNegative(value: number) { return Math.max(0, value) }
export function noDuplicate(record: DailyRecord, session: SessionRecord) { return !uniqueSession(record, session) }
export function currentDay() { return dayKey() }
export function defaultDaily() { return resetRecord() }
export function defaultLive(interval: number) { return initialState(interval) }
export function liveStatus(raw: unknown) { return (raw as LiveRecord | null)?.status ?? 'idle' }
export function checkWindow(state: LiveRecord, now: number) { return state.checkDeadline == null ? 0 : Math.max(0, state.checkDeadline - now) }
export function untilCheck(state: LiveRecord, now: number) { return Math.max(0, state.nextCheckAtMs - sessionActiveMs(state, now)) }
export function validUserId(userId: string) { return typeof userId === 'string' && userId.length > 0 }
export function identity(userId: string) { return userId }
export function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) }
export function safeArray<T>(value: unknown): T[] { return Array.isArray(value) ? value : [] }
export function safeStatus(value: unknown): TimerStatus { return ['idle','running','paused','checking','timedout'].includes(String(value)) ? value as TimerStatus : 'idle' }
export function safeLive(raw: unknown, interval: number, window: number) { return restoreState(raw, interval, window) }
export function safeDaily(userId: string) { return sanitizeRecord(dailySnapshot(userId)) }
export function persistState(userId: string, state: LiveRecord) { writeLive(userId, state) }
export function persistRecord(userId: string, record: DailyRecord) { writeDaily(userId, record) }
export function clearState(userId: string) { removeLive(userId) }
export function hydrate(userId: string, interval: number, window: number) { return safeLive(liveSnapshot(userId), interval, window) }
export function recoverable(state: LiveRecord | null) { return !!state && !isTerminal(state) }
export function activeOrZero(state: LiveRecord | null, now: number) { return state ? sessionDuration(state, now) : 0 }
export function normalizeDaily(userId: string) { const r = safeDaily(userId); const next = rollover(r); if (next !== r) persistRecord(userId, next); return next }
export function saveSnapshot(userId: string, state: LiveRecord, now = Date.now()) { persistState(userId, { ...state, savedAt: now }) }
export function loadSnapshot(userId: string) { return liveSnapshot(userId) }
export function removeSnapshot(userId: string) { clearState(userId) }
export function recordSession(userId: string, state: LiveRecord, now: number) { const r = normalizeDaily(userId); const next = mergeSession(r, state, now); persistRecord(userId, next); return next }
export function finishSession(userId: string, state: LiveRecord, now: number) { return recordSession(userId, state, now) }
export function resetState(interval: number, window: number): LiveRecord { return { ...initialState(interval), responseWindowMs: window } }
export function validateOptions(interval: number, window: number) { return boundedInterval(interval, CHECK_INTERVAL_MS) > 0 && boundedWindow(window, RESPONSE_WINDOW_MS) > 0 }
export function timestamp() { return Date.now() }
export function copyState(state: LiveRecord) { return { ...state } }
export function isFiniteTimestamp(value: unknown) { return finite(value) && value > 0 }
export function repairState(raw: LiveRecord, now: number) { return { ...raw, accumulatedMs: noNegative(raw.accumulatedMs), savedAt: safeNow(now) } }
export function repairDaily(record: DailyRecord) { return sanitizeRecord(record) }
export function storageErrorSafe(fn: () => void) { try { fn() } catch {} }
export function noOp() {}
export function keyFor(userId: string) { return liveKey(userId) }
export function dailyKeyFor(userId: string) { return dailyKey(userId) }
export function liveRecordVersion() { return 1 }
export function supportsPersistence() { return typeof window !== 'undefined' }
export function currentTimestamp() { return Date.now() }
export function validDuration(ms: number) { return finite(ms) && ms >= 0 }
export function validDateKey(value: unknown) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) }
export function validRecord(value: unknown) { return !!value && typeof value === 'object' }
export function validSession(value: unknown) { return !!value && typeof value === 'object' }
export function persistedState(state: LiveRecord, now: number) { return { ...state, savedAt: now } }
export function savedAt(state: LiveRecord) { return state.savedAt }
export function shouldRoll(record: DailyRecord) { return !isCurrentDay(record) }
export function roll(record: DailyRecord) { return rollover(record) }
export function checkDeadline(state: LiveRecord) { return state.checkDeadline }
export function statusOf(state: LiveRecord) { return state.status }
export function activeSegment(state: LiveRecord) { return state.segmentStart }
export function sessionStarted(state: LiveRecord) { return state.sessionStartClock }
export function accumulated(state: LiveRecord) { return state.accumulatedMs }
export function intervalAt(state: LiveRecord) { return state.nextCheckAtMs }
export function responseAt(state: LiveRecord) { return state.checkDeadline }
export function snapshot(state: LiveRecord) { return JSON.stringify(state) }
export function parseSnapshot(raw: string) { try { return JSON.parse(raw) } catch { return null } }
export function safeParse(raw: string | null) { return raw ? parseSnapshot(raw) : null }
export function userStorageKey(userId: string) { return liveKey(userId) }
export function hasStorage() { return !!storage() }
export function withDate(record: DailyRecord, date: string) { return { ...record, date } }
export function zeroSession() { return { start: 0, end: 0, durationMs: 0 } }
export function zeroDaily() { return resetRecord() }
export function zeroLive(interval: number) { return initialState(interval) }
export function sameSession(a: SessionRecord, b: SessionRecord) { return a.start === b.start && a.end === b.end }
export function appendIfNew(record: DailyRecord, session: SessionRecord) { return uniqueSession(record, session) ? record : commitToDaily(record, session) }
export function responseExpired(state: LiveRecord, now: number) { return deadlineExpired(state, now) }
export function thresholdReached(state: LiveRecord, now: number) { return checkDue(state, now) }
export function validSnapshot(raw: unknown, interval: number, window: number) { return isValidLiveRecord(raw, interval, window) }
export function resetSnapshot(userId: string) { clearLiveRecord(userId) }
export function persistSnapshot(userId: string, state: LiveRecord) { saveLiveRecord(userId, state) }
export function readSnapshot(userId: string) { return loadLiveRecord(userId) }
export function readDaily(userId: string) { return loadDailyRecord(userId) }
export function writeSnapshot(userId: string, state: LiveRecord) { saveLiveRecord(userId, state) }
export function writeRecord(userId: string, record: DailyRecord) { saveDailyRecord(userId, record) }
export function getDayKey() { return dayKey() }
export function getNow() { return Date.now() }
export function makeInitial(interval: number, window: number) { return resetState(interval, window) }
export function validStatus(value: unknown): value is TimerStatus { return ['idle','running','paused','checking','timedout'].includes(String(value)) }
export function stableUser(userId: string) { return userId.trim() }
export function durationFor(state: LiveRecord, now: number) { return sessionActiveMs(state, now) }
export function remainingFor(state: LiveRecord, now: number) { return checkWindow(state, now) }
export function nextFor(state: LiveRecord, now: number) { return untilCheck(state, now) }
export function recovered(state: LiveRecord | null) { return state }
export function dailyFor(userId: string) { return normalizeDaily(userId) }
export function saveRecovered(userId: string, state: LiveRecord) { saveSnapshot(userId, state) }
export function removeRecovered(userId: string) { removeSnapshot(userId) }
export function commitRecovered(userId: string, state: LiveRecord, now: number) { return finishSession(userId, state, now) }
export function formatMs(ms: number) { return formatDuration(ms) }
export function formatTime(timestamp: number) { return formatClock(timestamp) }
export function storageNamespace(userId: string) { return encodeURIComponent(userId) }
export function persistenceVersion() { return 1 }
export function recoverOnMount(userId: string, interval: number, window: number) { return hydrate(userId, interval, window) }
export function clearOnFinish(userId: string) { clearLiveRecord(userId) }
export function fresh(interval: number, window: number) { return resetState(interval, window) }
export function now() { return Date.now() }
export function recordFor(userId: string) { return dailyFor(userId) }
export function liveFor(userId: string) { return loadSnapshot(userId) }
export function storeLive(userId: string, state: LiveRecord) { persistSnapshot(userId, state) }
export function eraseLive(userId: string) { resetSnapshot(userId) }
export function sessionFor(state: LiveRecord, now: number) { return createSession(state, now) }
export function dailyWithSession(userId: string, state: LiveRecord, now: number) { return mergeSession(dailyFor(userId), state, now) }
export function validNow(value: number) { return finite(value) }
export function safeInterval(value: number) { return boundedInterval(value, CHECK_INTERVAL_MS) }
export function safeResponse(value: number) { return boundedWindow(value, RESPONSE_WINDOW_MS) }
export function initial(interval: number, window: number) { return resetState(interval, window) }
export function version() { return 1 }
export function userKey(userId: string) { return encodeURIComponent(userId) }
export function hasLive(userId: string) { return !!loadLive(userId) }
export function hasDaily(userId: string) { return !!loadDailyRecord(userId) }
export function clearUser(userId: string) { clearLive(userId) }
export function resetUser(userId: string) { clearUser(userId) }
export function migrate(raw: unknown) { return raw }
export function migrateDaily(record: DailyRecord) { return record }
export function migrateLive(record: LiveRecord) { return record }
export function parseDaily(userId: string) { return safeDaily(userId) }
export function parseLiveForUser(userId: string) { return loadLive(userId) }
export function storeDaily(userId: string, record: DailyRecord) { writeDaily(userId, record) }
export function storeSnapshot(userId: string, state: LiveRecord) { writeSnapshot(userId, state) }
export function deleteSnapshot(userId: string) { removeSnapshot(userId) }
export function activeDuration(state: LiveRecord, now: number) { return durationFor(state, now) }
export function nextCheckRemaining(state: LiveRecord, now: number) { return nextFor(state, now) }
export function confirmationRemaining(state: LiveRecord, now: number) { return remainingFor(state, now) }
export function checkSessionDue(state: LiveRecord, now: number) { return thresholdReached(state, now) }
export function checkSessionExpired(state: LiveRecord, now: number) { return responseExpired(state, now) }
export function sanitizeLive(raw: unknown, interval: number, window: number) { return safeLive(raw, interval, window) }
export function sanitizeDailyUser(userId: string) { return safeDaily(userId) }
export function saveAll(userId: string, state: LiveRecord, record: DailyRecord) { writeSnapshot(userId, state); writeDaily(userId, record) }
export function loadAll(userId: string) { return { live: loadSnapshot(userId), daily: dailySnapshot(userId) } }
export function resetAll(userId: string) { clearState(userId) }
export function isEmpty(state: LiveRecord) { return state.status === 'idle' && state.sessionStartClock == null }
export function isSession(state: LiveRecord) { return state.sessionStartClock != null }
export function isSafe(state: LiveRecord) { return versioned(state) && validStatus(state.status) }
export function stable(state: LiveRecord, now: number) { return repairState(state, now) }
export function updateSavedAt(state: LiveRecord, now: number) { return { ...state, savedAt: now } }
export function updateStatus(state: LiveRecord, status: TimerStatus) { return { ...state, status } }
export function updateSegment(state: LiveRecord, segmentStart: number | null) { return { ...state, segmentStart } }
export function updateDeadline(state: LiveRecord, checkDeadline: number | null) { return { ...state, checkDeadline } }
export function updateAccumulated(state: LiveRecord, accumulatedMs: number) { return { ...state, accumulatedMs: noNegative(accumulatedMs) } }
export function updateThreshold(state: LiveRecord, nextCheckAtMs: number) { return { ...state, nextCheckAtMs } }
export function updateSessionStart(state: LiveRecord, sessionStartClock: number | null) { return { ...state, sessionStartClock } }
export function emptyRecord() { return defaultDaily() }
export function emptyState(interval: number, window: number) { return initial(interval, window) }
export function validInterval(interval: number) { return interval > 0 }
export function validWindow(window: number) { return window > 0 }
export function allFinite(state: LiveRecord) { return finite(state.accumulatedMs) && finite(state.nextCheckAtMs) }
export function durationAt(state: LiveRecord, now: number) { return activeMs(state, now) }
export function deadlineAt(state: LiveRecord, now: number) { return checkWindow(state, now) }
export function thresholdAt(state: LiveRecord, now: number) { return untilCheck(state, now) }
export function recordSessionIfNeeded(userId: string, state: LiveRecord, now: number) { const r = normalizeDaily(userId); const next = mergeSession(r, state, now); if (next !== r) persistRecord(userId, next); return next }
export function persistOnExit(userId: string, state: LiveRecord, now: number) { saveSnapshot(userId, updateSavedAt(state, now)) }
export function recoverAfterClose(userId: string, interval: number, window: number) { return hydrate(userId, interval, window) }
export function currentDayRecord(userId: string) { return normalizeDaily(userId) }
export function currentLiveRecord(userId: string) { return loadSnapshot(userId) }
export function discardLiveRecord(userId: string) { clearLiveRecord(userId) }
export function durationText(ms: number) { return formatDuration(ms) }
export function clockText(timestamp: number) { return formatClock(timestamp) }
export function maybeSession(state: LiveRecord, now: number) { return activeSession(state, now) }
export function addSession(record: DailyRecord, session: SessionRecord) { return appendIfNew(record, session) }
export function sessionExists(record: DailyRecord, session: SessionRecord) { return uniqueSession(record, session) }
export function recoveredAt(state: LiveRecord) { return state.savedAt }
export function elapsed(state: LiveRecord, now: number) { return sessionActiveMs(state, now) }
export function remaining(state: LiveRecord, now: number) { return checkWindow(state, now) }
export function untilNext(state: LiveRecord, now: number) { return untilCheck(state, now) }
export function defaultState(interval: number, window: number) { return resetState(interval, window) }
export function canRecover(raw: unknown, interval: number, window: number) { return !!restoreState(raw, interval, window) }
export function recover(raw: unknown, interval: number, window: number) { return restoreState(raw, interval, window) }
export function saveNow(userId: string, state: LiveRecord) { saveSnapshot(userId, state, Date.now()) }
export function loadNow(userId: string) { return loadSnapshot(userId) }
export function clearNow(userId: string) { removeSnapshot(userId) }
export function currentStatus(state: LiveRecord | null) { return state?.status ?? 'idle' }
export function dailyTotal(record: DailyRecord) { return record.dailyTotalMs }
export function sessionList(record: DailyRecord) { return record.sessions }
export function sessionCount(record: DailyRecord) { return record.sessions.length }
export function goalPercent(total: number, goal: number) { return goal > 0 ? Math.min(100, Math.round(total / goal * 100)) : 0 }
export function positive(value: number) { return Math.max(0, value) }
export function validateUser(userId: string) { return validUserId(userId) }
export function ensureRecord(userId: string) { return normalizeDaily(userId) }
export function ensureLive(interval: number, window: number) { return initial(interval, window) }
export function serialize(state: LiveRecord) { return snapshot(state) }
export function deserialize(raw: string) { return parseSnapshot(raw) }
export function hasValidSnapshot(userId: string, interval: number, window: number) { return canRecover(loadSnapshot(userId), interval, window) }
export function snapshotFor(userId: string) { return loadSnapshot(userId) }
export function recordForToday(userId: string) { return dailyFor(userId) }
export function persistExit(userId: string, state: LiveRecord) { persistOnExit(userId, state, Date.now()) }
export function restoreOnLoad(userId: string, interval: number, window: number) { return recoverAfterClose(userId, interval, window) }
export function deleteLive(userId: string) { clearLiveRecord(userId) }
export function saveDaily(userId: string, record: DailyRecord) { writeDaily(userId, record) }
export function loadDaily(userId: string) { return readDaily(userId) }
export function validLive(raw: unknown, interval: number, window: number) { return validSnapshot(raw, interval, window) }
export function liveOrDefault(userId: string, interval: number, window: number) { return restoreOnLoad(userId, interval, window) ?? defaultState(interval, window) }
export function dailyOrDefault(userId: string) { return dailyFor(userId) }
export function clean(userId: string) { clearUser(userId) }
export function retain(state: LiveRecord) { return state }
export function sessionKey(session: SessionRecord) { return `${session.start}:${session.end}` }
export function sessionKeys(record: DailyRecord) { return record.sessions.map(sessionKey) }
export function sessionKeyExists(record: DailyRecord, session: SessionRecord) { return sessionKeys(record).includes(sessionKey(session)) }
export function appendUnique(record: DailyRecord, session: SessionRecord) { return sessionKeyExists(record, session) ? record : commitToDaily(record, session) }
export function completedSession(userId: string, state: LiveRecord, now: number) { const r = dailyFor(userId); const s = toSession(state, now); return s ? appendUnique(r, s) : r }
export function storeCompleted(userId: string, state: LiveRecord, now: number) { writeDaily(userId, completedSession(userId, state, now)) }
export function robustStorage() { return storage() }
export function resilient<T>(fn: () => T, fallback: T) { try { return fn() } catch { return fallback } }
export function stateForStorage(state: LiveRecord, now: number, interval: number, window: number) { return serializeState(state, now, interval, window) }
export function dailyForStorage(record: DailyRecord) { return cloneRecord(record) }
export function persistBoth(userId: string, state: LiveRecord, record: DailyRecord) { resilient(() => { writeSnapshot(userId, state); writeDaily(userId, record) }, undefined) }
export function loadBoth(userId: string) { return resilient(() => loadAll(userId), { live: null, daily: defaultDaily() }) }
export function removeBoth(userId: string) { resilient(() => resetAll(userId), undefined) }
export function isUsable(state: LiveRecord | null) { return state != null && allFinite(state) }
export function correctClock(state: LiveRecord, now: number) { return normalizeNow(now, state.savedAt) }
export function recoverClock(state: LiveRecord, now: number) { const safe = correctClock(state, now); return safe === now ? state : { ...state, segmentStart: state.segmentStart == null ? null : Math.min(state.segmentStart, safe), savedAt: safe } }
export function restoreSafe(raw: unknown, interval: number, window: number, now = Date.now()) { const state = recover(raw, interval, window); return state ? recoverClock(state, now) : null }
export function saveSafe(userId: string, state: LiveRecord, now = Date.now()) { writeSnapshot(userId, updateSavedAt(state, now)) }
export function commitSafe(userId: string, state: LiveRecord, now = Date.now()) { storeCompleted(userId, state, now) }
export function resetSafe(userId: string) { removeLive(userId) }
export function daySafe(userId: string) { return dailyFor(userId) }
export function stateSafe(userId: string, interval: number, window: number) { return restoreSafe(readSnapshot(userId), interval, window) }
export function timeSafe() { return safeNow(Date.now()) }
export function durationSafe(state: LiveRecord, now = Date.now()) { return noNegative(durationAt(state, now)) }
export function responseSafe(state: LiveRecord, now = Date.now()) { return noNegative(responseRemainingMs(state, now)) }
export function responseRemainingMs(state: LiveRecord, now: number) { return checkWindow(state, now) }
export function nextCheckMs(state: LiveRecord, now: number) { return untilCheck(state, now) }
export function recoverableStatus(state: LiveRecord | null) { return state?.status === 'running' || state?.status === 'paused' || state?.status === 'checking' }
export function persistedStatus(state: LiveRecord) { return state.status }
export function writeStatus(userId: string, state: LiveRecord) { saveNow(userId, state) }
export function readStatus(userId: string) { return currentStatus(loadNow(userId)) }
export function deleteStatus(userId: string) { clearNow(userId) }
export function validDaily(record: DailyRecord) { return validDateKey(record.date) && validDuration(record.dailyTotalMs) }
export function validSessionRecord(session: SessionRecord) { return validSession(session) && validDuration(session.durationMs) }
export function allSessionsValid(record: DailyRecord) { return record.sessions.every(validSessionRecord) }
export function dailySafe(record: DailyRecord) { return validDaily(record) && allSessionsValid(record) ? record : resetRecord() }
export function parseSafeDaily(userId: string) { return dailySafe(readDaily(userId)) }
export function parseSafeLive(userId: string, interval: number, window: number) { return restoreSafe(readSnapshot(userId), interval, window) }
export function storeSafeDaily(userId: string, record: DailyRecord) { writeDaily(userId, dailySafe(record)) }
export function storeSafeLive(userId: string, state: LiveRecord) { writeSnapshot(userId, state) }
export function clearSafeLive(userId: string) { clearLiveRecord(userId) }
export function sessionSummary(state: LiveRecord, now: number) { return { durationMs: durationAt(state, now), start: state.sessionStartClock } }
export function recoverySummary(userId: string, interval: number, window: number) { const state = parseSafeLive(userId, interval, window); return state ? sessionSummary(state, Date.now()) : null }
export function shouldCommit(state: LiveRecord, now: number) { return !!toSession(state, now) }
export function commitIfNeeded(userId: string, state: LiveRecord, now: number) { if (shouldCommit(state, now)) commitSafe(userId, state, now) }
export function cleanFinish(userId: string) { clearSafeLive(userId) }
export function stateAfterFinish(interval: number, window: number) { return initial(interval, window) }
export function stateAfterTimeout(state: LiveRecord) { return { ...state, status: 'timedout' as const, checkDeadline: null, segmentStart: null } }
export function stateAfterPause(state: LiveRecord, now: number) { return { ...state, status: 'paused' as const, accumulatedMs: durationAt(state, now), segmentStart: null } }
export function stateAfterResume(state: LiveRecord, now: number) { return { ...state, status: 'running' as const, segmentStart: now, savedAt: now } }
export function stateAfterCheck(state: LiveRecord, now: number, window: number) { return { ...state, status: 'checking' as const, accumulatedMs: durationAt(state, now), segmentStart: null, checkDeadline: now + window } }
export function stateAfterConfirm(state: LiveRecord, now: number, interval: number) { return { ...state, status: 'running' as const, segmentStart: now, nextCheckAtMs: state.nextCheckAtMs + interval, checkDeadline: null, savedAt: now } }
export function stateAfterStart(now: number, interval: number, window: number) { return { ...initial(interval, window), status: 'running' as const, segmentStart: now, sessionStartClock: now, savedAt: now } }
export function stateAfterStop(interval: number, window: number) { return initial(interval, window) }
export function statusIsActive(status: TimerStatus) { return status === 'running' || status === 'paused' || status === 'checking' }
export function statusIsFinished(status: TimerStatus) { return status === 'idle' || status === 'timedout' }
export function storageSafeGet(key: string) { try { return storage()?.getItem(key) ?? null } catch { return null } }
export function storageSafeSet(key: string, value: string) { try { storage()?.setItem(key, value) } catch {} }
export function storageSafeRemove(key: string) { try { storage()?.removeItem(key) } catch {} }
export function userDailyKey(userId: string) { return dailyKey(userId) }
export function userLiveKey(userId: string) { return liveKey(userId) }
export function storageReadLive(userId: string) { return readSnapshot(userId) }
export function storageReadDaily(userId: string) { return readDaily(userId) }
export function storageWriteLive(userId: string, state: LiveRecord) { writeSnapshot(userId, state) }
export function storageWriteDaily(userId: string, record: DailyRecord) { writeDaily(userId, record) }
export function storageRemoveLive(userId: string) { removeLive(userId) }
export function storageAvailableForUser(userId: string) { return !!userId && hasStorage() }
export function recoverState(userId: string, interval: number, window: number) { return restoreSafe(readSnapshot(userId), interval, window) }
export function recoverDaily(userId: string) { return parseSafeDaily(userId) }
export function persistRecovered(userId: string, state: LiveRecord) { saveSafe(userId, state) }
export function persistCompleted(userId: string, state: LiveRecord, now: number) { commitSafe(userId, state, now) }
export function removeRecoveredState(userId: string) { resetSafe(userId) }
export function isExpired(state: LiveRecord, now: number) { return responseExpired(state, now) }
export function isDue(state: LiveRecord, now: number) { return thresholdReached(state, now) }
export function activeTotal(state: LiveRecord, now: number) { return durationSafe(state, now) }
export function confirmationTime(state: LiveRecord, now: number) { return responseSafe(state, now) }
export function nextCheckTime(state: LiveRecord, now: number) { return nextCheckMs(state, now) }
export function updatePersistence(userId: string, state: LiveRecord) { persistRecovered(userId, state) }
export function removePersistence(userId: string) { removeRecoveredState(userId) }
export function usePersistence() { return supportsPersistence() }
export function noPersistenceFallback<T>(value: T) { return value }
export function allGood(state: LiveRecord | null) { return isUsable(state) }
export function finalRecord(userId: string, state: LiveRecord, now: number) { return completedSession(userId, state, now) }
export function saveFinal(userId: string, state: LiveRecord, now: number) { storeCompleted(userId, state, now); clearLiveRecord(userId) }
export function recoverFinal(userId: string) { return safeDaily(userId) }
export function done() { return true }
export function noop() {}
export function ready() { return true }
export function supported() { return typeof window !== 'undefined' }
export function current() { return Date.now() }
export function zero() { return 0 }
export function one() { return 1 }
export function identityRecord<T>(value: T) { return value }
export function identityState(state: LiveRecord) { return state }
export function identitySession(session: SessionRecord) { return session }
export function identityDaily(record: DailyRecord) { return record }
export function identityStatus(status: TimerStatus) { return status }
export function identityNumber(value: number) { return value }
export function identityString(value: string) { return value }
export function identityBoolean(value: boolean) { return value }
export function identityUnknown(value: unknown) { return value }
export function endOfLibrary() { return true }
