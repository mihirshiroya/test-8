import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ProfileAnalytics } from '../../components/Ui/analytics-data'
import { formatMinutes, localDayKey } from '../../components/Ui/analytics-data'
import { ActivityHeatmap } from '../../components/Ui/activity-heatmap'

export function ProfileInsights({ data, month, loading, onMonthChange }: { data: ProfileAnalytics; month: string; loading: boolean; onMonthChange: (month: string) => void }) {
  const [year, monthNumber] = month.split('-').map(Number)
  const days = Array.from({ length: new Date(year, monthNumber, 0).getDate() }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, '0')}`
    return data.monthly.days.find(d => d.date.slice(0, 10) === date) ?? { date, completed: 0, focusMinutes: 0 }
  })
  const max = Math.max(1, ...days.map(d => d.completed))
  const focusMax = Math.max(1, ...data.focus30.days.map(d => d.minutes))
  const moveMonth = (direction: number) => {
    const d = new Date(year, monthNumber - 1 + direction, 1)
    onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return <section aria-label="Activity and focus insights" className="flex flex-col gap-5">
    <div className="work-card min-w-0 overflow-x-auto p-4"><ActivityHeatmap cells={data.heatmap} /></div>
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="work-card min-w-0 p-5" aria-busy={loading}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-sm font-semibold">Daily productivity</h2><p className="mt-1 text-xs text-secondary">{data.monthly.avgTasksPerDay} completed tasks / day</p></div>
          <div className="flex items-center gap-2"><button className="work-icon" aria-label="Previous month" disabled={loading} onClick={() => moveMonth(-1)}><ChevronLeft size={14} /></button><span className="text-xs">{new Date(year, monthNumber - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span><button className="work-icon" aria-label="Next month" disabled={loading || month >= localDayKey().slice(0, 7)} onClick={() => moveMonth(1)}><ChevronRight size={14} /></button></div>
        </div>
        <div className="mt-6 flex h-36 items-end gap-1" role="img" aria-label={`${data.monthly.totalCompleted} tasks completed in ${month}`}>
          {days.map(day => <div key={day.date} tabIndex={0} title={`${day.date}: ${day.completed} tasks, ${formatMinutes(day.focusMinutes)} focused`} aria-label={`${day.date}: ${day.completed} tasks`} className="min-w-0 flex-1 rounded-t-sm bg-[var(--chart-2)] opacity-80 hover:opacity-100 focus:opacity-100" style={{ height: day.completed ? `${Math.max(3, day.completed / max * 100)}%` : '3px' }} />)}
        </div>
        <div className="mt-3 flex justify-between text-xs text-secondary"><span>1 {new Date(year, monthNumber - 1).toLocaleDateString('en-US', { month: 'short' })}</span><span>{days.length}</span></div>
      </section>
      <section className="work-card min-w-0 p-5">
        <div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-sm font-semibold">Focus time</h2><p className="mt-1 text-xs text-secondary">Last 30 days</p></div><span className="text-xl font-semibold tabular-nums">{formatMinutes(data.focus30.totalMinutes)}</span></div>
        <div className="mt-6 flex h-36 items-end gap-1" role="img" aria-label={`${formatMinutes(data.focus30.totalMinutes)} focused in the last 30 days`}>
          {data.focus30.days.map(day => <div key={day.date} tabIndex={0} title={`${day.date}: ${formatMinutes(day.minutes)}`} aria-label={`${day.date}: ${formatMinutes(day.minutes)}`} className="min-w-0 flex-1 rounded-t-sm bg-[var(--chart-3)] opacity-80 hover:opacity-100 focus:opacity-100" style={{ height: day.minutes ? `${Math.max(3, day.minutes / focusMax * 100)}%` : '3px' }} />)}
        </div>
        <p className="mt-3 text-xs text-secondary">{data.focus30.prevTotalMinutes > 0 ? `${data.focus30.delta > 0 ? '+' : ''}${data.focus30.delta}% compared with the previous 30 days` : data.focus30.totalMinutes ? 'Your focus journey is underway.' : 'Complete a focus session to see your progress.'}</p>
      </section>
    </div>
  </section>
}
