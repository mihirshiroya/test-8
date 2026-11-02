export interface SessionRecord {
  id: string
  taskName: string
  /** ISO timestamp */
  start: string
  /** ISO timestamp */
  end: string
}

export interface SessionHistory {
  date: string
  goalSeconds: number
  sessions: SessionRecord[]
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

/** Compact human duration, e.g. "1h 15m" or "1m 14s". */
export function formatCompact(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

export function formatClock(date: Date): string {
  return date
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toUpperCase()
}

export function durationSeconds(session: SessionRecord): number {
  return Math.max(
    0,
    (new Date(session.end).getTime() - new Date(session.start).getTime()) / 1000,
  )
}
