import { ArrowDownRight, ArrowUpRight, Clock, ListChecks, Minus, Target, Timer } from 'lucide-react'
import {
  type ComparisonMode,
  type Metric,
  formatValue,
  metricValues,
} from './analytics-data'

const ICONS = {
  focus: Clock,
  tasks: ListChecks,
  rate: Target,
  sessions: Timer,
} as const

export function StatCard({
  metric,
  mode,
}: {
  metric: Metric
  mode: ComparisonMode
  index?: number
}) {
  const Icon = ICONS[metric.key]
  const { current, previous, delta } = metricValues(metric, mode)
  const trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
  const TrendIcon = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : Minus
  const periodLabel = mode === 'today' ? 'yesterday' : 'last week'

  return (
    <div className="workspace-metric">
      <div className="flex items-center justify-between gap-3">
        <span className="workspace-metric-label">{metric.label}</span>
        <span className="workspace-metric-icon" aria-hidden="true">
          <Icon className="size-4" strokeWidth={1.7} />
        </span>
      </div>
      <div className="workspace-metric-value">{formatValue(metric, current)}</div>
      <div className="workspace-metric-footer">
        <span className="workspace-metric-delta" data-trend={trend}>
          <TrendIcon className="size-3" aria-hidden="true" />
          <span>{delta > 0 ? '+' : ''}{delta}%</span>
        </span>
        <span>vs {formatValue(metric, previous)} {periodLabel}</span>
      </div>
    </div>
  )
}
