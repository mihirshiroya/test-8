import { useMemo, useState } from 'react'
import { type HeatCell, formatMinutes, localDayKey } from './analytics-data'
import { HeatmapLegend, heatmapBackground } from './heatmap-legend'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
type Slot = { key: string; date: Date; minutes: number; future: boolean }
function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}
const shortDate = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

export function WeeklyHeatmap({ cells, weeks = 12 }: { cells: HeatCell[]; weeks?: number }) {
  const [active, setActive] = useState<Slot | null>(null)
  const { columns, rows, max, totalMinutes, activeDays } = useMemo(() => {
    const today = new Date()
    const todayKey = localDayKey(today)
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
    const firstWeek = addDays(monday, -7 * (weeks - 1))
    const minutesByDate = new Map(cells.map(cell => [cell.date, cell.minutes]))
    const columns = Array.from({ length: weeks }, (_, i) => addDays(firstWeek, i * 7))
    const rows: Slot[][] = DAYS.map((_, day) => columns.map(week => {
      const date = addDays(week, day)
      const key = localDayKey(date)
      return { key, date, minutes: Math.max(0, minutesByDate.get(key) ?? 0), future: key > todayKey }
    }))
    const past = rows.flat().filter(slot => !slot.future)
    return { columns, rows, max: Math.max(1, ...past.map(slot => slot.minutes)),
      totalMinutes: past.reduce((sum, slot) => sum + slot.minutes, 0),
      activeDays: past.filter(slot => slot.minutes > 0).length }
  }, [cells, weeks])

  return (
    <section className="workspace-panel focus-heatmap flex h-full min-h-0 flex-col" aria-labelledby="weekly-heatmap-title">
      <header>
        <h3 id="weekly-heatmap-title" className="text-heading-5 text-primary">Weekly heatmap</h3>
        <p className="heatmap-summary">{activeDays} active days · {formatMinutes(totalMinutes)} focused in the last {weeks} weeks</p>
      </header>
      <div className="heatmap-scroll" role="region" aria-label="Scrollable weekly focus calendar" tabIndex={0}>
        <table className="heatmap-table w-full min-w-[340px] table-fixed" onMouseLeave={() => setActive(null)}>
          <caption className="sr-only">Focus minutes by weekday over the last {weeks} weeks. Outlined circles indicate future days.</caption>
          <colgroup><col className="w-8" />{columns.map((_, i) => <col key={i} />)}</colgroup>
          <thead><tr><th scope="col"><span className="sr-only">Week starting</span></th>{columns.map((date, i) => (
            <th key={localDayKey(date)} scope="col"><span className="sr-only">{shortDate(date)}</span><span aria-hidden="true">{i % 4 === 0 ? date.toLocaleDateString(undefined, { month: 'short' }) : ''}</span></th>
          ))}</tr></thead>
          <tbody>{rows.map((row, day) => <tr key={DAYS[day]}>
            <th scope="row">{DAYS[day]}</th>
            {row.map(slot => <td key={slot.key}>
              {slot.future ? <span className="heatmap-dot heatmap-dot--future" title={`${shortDate(slot.date)}: future day`} /> : (
                <button type="button" className="heatmap-dot" aria-label={`${DAYS[day]}, ${shortDate(slot.date)}: ${formatMinutes(slot.minutes)} focused`}
                  title={`${shortDate(slot.date)} · ${formatMinutes(slot.minutes)}`} style={{ background: heatmapBackground(slot.minutes, max) }}
                  onMouseEnter={() => setActive(slot)} onFocus={() => setActive(slot)} onBlur={() => setActive(null)} />
              )}
            </td>)}
          </tr>)}</tbody>
        </table>
      </div>
      <footer className="heatmap-footer">
        <span className="heatmap-axis" aria-live="polite">{active ? `${shortDate(active.date)} · ${formatMinutes(active.minutes)} focused` : 'Mon – Sun, top to bottom'}</span>
        <HeatmapLegend />
      </footer>
    </section>
  )
}
