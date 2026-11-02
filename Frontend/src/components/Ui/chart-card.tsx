import { useState, type ReactNode } from 'react'
import { formatNumber, useCountUp } from '../../lib/chart-utils'

export type Period<T> = { id: string; label: string; data: T }
export function usePeriod<T>(periods: Period<T>[], controlledId?: string) {
  const [internalId, setInternalId] = useState(periods[0]?.id)
  const period = periods.find(p => p.id === (controlledId ?? internalId)) ?? periods[0]
  return { period, periodId: period?.id, setPeriodId: setInternalId }
}
export function ChartCard({ title, subtitle, value, format = formatNumber, children, className = '' }: {
  title: string; subtitle?: string; value?: number; format?: (value: number) => string; children: ReactNode; className?: string
}) {
  const animated = useCountUp(value ?? 0)
  return (
    <section aria-label={title} className={`work-card flex min-w-0 flex-col gap-5 p-5 sm:p-6 ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="text-sm font-semibold">{title}</h3>{subtitle && <p className="mt-1 text-body-sm text-steel !font-semibold !font-inter">{subtitle}</p>}</div>
        {value !== undefined && <span className="text-2xl font-semibold tracking-tight tabular-nums">{format(animated)}</span>}
      </header>
      {children}
    </section>
  )
}
export function StatTile({ label, value, color, active, dimmed, onMouseEnter, onMouseLeave }: {
  label: string; value: ReactNode; color?: string; active?: boolean; dimmed?: boolean; onMouseEnter?: () => void; onMouseLeave?: () => void
}) {
  return <div tabIndex={0} onFocus={onMouseEnter} onBlur={onMouseLeave} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
    className={`work-stat flex min-w-0 flex-col gap-2 border p-3 transition-opacity ${dimmed ? 'opacity-50' : ''} ${active ? 'border-[var(--color-primary)]' : 'border-soft'}`}>
    <span className="flex items-start gap-2 text-xs text-secondary"><span aria-hidden="true" className="mt-1 size-2 shrink-0 rounded-full" style={{ background: color }} />{label}</span>
    <span className="text-lg font-semibold tabular-nums">{value}</span>
  </div>
}
