export type ComparisonMode = "today" | "week"

export type SeriesPoint = {
  label: string
  current: number
  previous: number
}

export type MetricKey = "focus" | "tasks" | "rate" | "sessions"

export type Metric = {
  key: MetricKey
  label: string
  today: number
  yesterday: number
  weekTotal: number
  prevWeekTotal: number
  unit: "minutes" | "count" | "percent"
  invert?: boolean
}

export type Activity = {
  id: string
  kind: "completed" | "created" | "focus" | "comment" | "milestone"
  type?: string
  text: string
  meta: string
  ago: string
  at?: number
}

export type HeatCell = {
  date: string
  value: number // 0-4 intensity
  minutes: number
  completed?: number
}

export type AnalyticsData = {
  generatedAt: number
  metrics: Metric[]
  weekSeries: SeriesPoint[]
  daySeries: SeriesPoint[]
  activity: Activity[]
  heatmap: HeatCell[]
}

export type SessionEntry = {
  id: string
  taskId: string
  taskName: string
  workspaceName: string | null
  start: string
  end: string
  durationSeconds: number
  running: boolean
}

export type SessionDay = {
  date: string
  goalSeconds: number
  sessions: SessionEntry[]
}

export type ProjectSummary = {
  id: string
  name: string
  tint: string
  icon: string
  total: number
  done: number
  status: "Planning" | "In progress" | "Done"
}

export type Achievement = {
  id: string
  title: string
  requiredHours: number
  color: string
  icon: string
  unlocked: boolean
  progress: number
}

export type ProfileAnalytics = {
  generatedAt: number
  stats: {
    totalCompleted: number
    bestDay: { date: string; count: number } | null
    longestSessionSeconds: number
    currentStreak: number
    longestStreak: number
  }
  heatmap: HeatCell[]
  monthly: {
    month: string
    days: { date: string; completed: number; focusMinutes: number }[]
    totalCompleted: number
    avgTasksPerDay: number
  }
  focus30: {
    days: { date: string; minutes: number }[]
    totalMinutes: number
    prevTotalMinutes: number
    delta: number
  }
  focusMonth?: {
    month: string
    days: { date: string; minutes: number }[]
    totalMinutes: number
    avgMinutesPerDay: number
    prevTotalMinutes: number
    delta: number
  }
  projects: ProjectSummary[]
  achievements: Achievement[]
  currentAchievement: Achievement | null
  totalFocusHours: number
  pfpFrame: string
}

export function formatMinutes(min: number): string {
  const total = Math.max(0, Math.round(min))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function formatValue(m: Metric, value: number): string {
  if (m.unit === "minutes") return formatMinutes(value)
  if (m.unit === "percent") return `${value}%`
  return `${value}`
}

export function metricValues(m: Metric, mode: ComparisonMode) {
  const current = mode === "today" ? m.today : m.weekTotal
  const previous = mode === "today" ? m.yesterday : m.prevWeekTotal
  const delta =
    previous === 0
      ? current > 0
        ? 100
        : 0
      : Math.round(((current - previous) / previous) * 100)
  return { current, previous, delta }
}

/** Local calendar day as "YYYY-MM-DD". */
export function localDayKey(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}
