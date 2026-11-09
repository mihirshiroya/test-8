import { useId, useMemo, useState } from 'react'
import { type HeatCell, formatMinutes, localDayKey } from './analytics-data'
import { HEATMAP_LEVELS, HeatmapLegend } from './heatmap-legend'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function ActivityHeatmap({ cells, year }: { cells: HeatCell[]; year?: number }) {
  const titleId = useId()
  const [active, setActive] = useState<HeatCell | null>(null)
  const currentYear = year ?? new Date().getFullYear()
  const { weeks, cellsByDate, monthLabels, activeDays, totalMinutes } = useMemo(() => {
    const start = new Date(currentYear, 0, 1)
    const end = new Date(currentYear, 11, 31)
    const gridStart = addDays(start, -((start.getDay() + 6) % 7))
    const weeks: Array<Array<Date | null>> = []
    const monthLabels = new Map<number, string>()
    for (let weekStart = gridStart; weekStart <= end; weekStart = addDays(weekStart, 7)) {
      const week = Array.from({ length: 7 }, (_, day) => {
        const date = addDays(weekStart, day)
        return date >= start && date <= end ? date : null
      })
      for (const date of week) {
        if (date?.getDate() === 1) monthLabels.set(weeks.length, MONTHS[date.getMonth()])
      }
      weeks.push(week)
    }
    const yearCells = cells.filter(cell => cell.date.startsWith(`${currentYear}-`))
    return {
      weeks,
      monthLabels,
      cellsByDate: new Map(yearCells.map(cell => [cell.date, cell])),
      activeDays: yearCells.filter(cell => cell.minutes > 0 || cell.value > 0).length,
      totalMinutes: yearCells.reduce((sum, cell) => sum + cell.minutes, 0),
    }
  }, [cells, currentYear])

  return (
    <section className="workspace-panel focus-heatmap" aria-labelledby={titleId}>
      <header>
        <h3 id={titleId} className="text-heading-5 text-primary">Consistency heatmap</h3>
        <p className="heatmap-summary">{activeDays} active days · {formatMinutes(totalMinutes)} focused in {currentYear}</p>
      </header>
      <div className="heatmap-scroll" role="region" aria-label={`${currentYear} focus calendar, scroll to see all months`} tabIndex={0}>
        <div className="year-heatmap-grid" style={{ gridTemplateColumns: `28px repeat(${weeks.length}, minmax(8px, 1fr))` }}>
          <span aria-hidden="true" />
          {weeks.map((_, index) => <span key={`month-${index}`} className="heatmap-axis heatmap-month">{monthLabels.get(index) ?? ''}</span>)}
          {DAYS.map((day, dayIndex) => (
            <div key={day} className="contents">
              <span className="heatmap-axis self-center">{dayIndex % 2 === 0 ? day : ''}</span>
              {weeks.map((week, weekIndex) => {
                const date = week[dayIndex]
                if (!date) return <span key={`empty-${weekIndex}`} />
                const key = localDayKey(date)
                const cell = cellsByDate.get(key) ?? { date: key, value: 0, minutes: 0 }
                const label = `${key}: ${formatMinutes(cell.minutes)} focused`
                return (
                  <button key={key} type="button" className="heatmap-dot" aria-label={label} title={label}
                    style={{ background: HEATMAP_LEVELS[Math.min(4, Math.max(0, Math.round(cell.value)))] }}
                    onMouseEnter={() => setActive(cell)} onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(cell)} onBlur={() => setActive(null)} />
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <footer className="heatmap-footer">
        <span className="heatmap-axis" aria-live="polite">{active ? `${active.date} · ${formatMinutes(active.minutes)} focused` : 'Mon – Sun, top to bottom'}</span>
        <HeatmapLegend />
      </footer>
    </section>
  )
}
