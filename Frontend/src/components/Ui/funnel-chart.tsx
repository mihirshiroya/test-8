import { useMemo, useState } from 'react'
import { chartColor, formatNumber } from '../../lib/chart-utils'
import { ChartCard, StatTile } from './chart-card'

export type FunnelStage = { name: string; value: number; color?: string }
export type FunnelData = { stages: FunnelStage[] }

const H = 100
const SEGMENT = 100
const RECT = 62
const CURVE = 18

export function FunnelChartCard({
  title,
  stages,
  subtitle,
}: {
  title: string
  stages: FunnelStage[]
  subtitle?: string
}) {
  const [active, setActive] = useState<number | null>(null)

  const max = Math.max(1, ...stages.map(s => s.value))
  const width = Math.max(1, stages.length) * SEGMENT

  const geometry = useMemo(
    () =>
      stages.map((stage, index) => {
        const height = (stage.value / max) * H
        const next = stages[index + 1]
        const nextHeight = next ? (next.value / max) * H : height

        const x0 = index * SEGMENT
        const x1 = x0 + RECT
        const x2 = x0 + SEGMENT

        const top = (H - height) / 2
        const bottom = (H + height) / 2
        const nextTop = (H - nextHeight) / 2
        const nextBottom = (H + nextHeight) / 2

        const path = !next
          ? `M${x0},${top} H${x2} V${bottom} H${x0} Z`
          : `M${x0},${top} H${x1} C${x1 + CURVE},${top} ${
              x2 - CURVE
            },${nextTop} ${x2},${nextTop} V${nextBottom} C${
              x2 - CURVE
            },${nextBottom} ${x1 + CURVE},${bottom} ${x1},${bottom} H${x0} Z`

        return {
          path,
          pillX: ((x0 + SEGMENT / 2) / width) * 100,
          share: Math.round((stage.value / max) * 100),
          color: chartColor(index, stage.color),
        }
      }),
    [stages, max, width],
  )

  return (
    <ChartCard
      title={
        <div className="flex items-center gap-2">
          <h3
        id="heatmap-title"
        className="text-heading-5 text-primary"
      >
        Projects
      </h3>
          <span className="work-pill px-2 py-0.5 text-xs font-medium tabular-nums">
            3
          </span>
        </div>
      }
      subtitle={active !== null ? stages[active]?.name : '12 tasks'}
      value={active !== null ? stages[active]?.value : stages[0]?.value}
    >
      

      {stages[0]?.value > 0 ? (
        <div
          className="relative my-2 h-32 sm:h-40"
          onMouseLeave={() => setActive(null)}
        >
          <svg
            className="absolute inset-0 size-full"
            viewBox={`0 0 ${width} ${H}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={stages
              .map(s => `${s.name}: ${s.value}`)
              .join(', ')}
          >
            {geometry.map((stage, index) => (
              <path
                key={stages[index].name}
                d={stage.path}
                fill={stage.color}
                opacity={active !== null && active !== index ? 0.3 : 0.85}
                onMouseEnter={() => setActive(index)}
                className="transition-opacity"
              />
            ))}
          </svg>

          {geometry.map((stage, index) => (
            <span
              key={stages[index].name}
              aria-hidden="true"
              className="work-pill pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 px-2 py-1 text-xs font-medium tabular-nums"
              style={{ left: `${stage.pillX}%` }}
            >
              {stage.share}%
            </span>
          ))}
        </div>
      ) : (
        <p className="work-empty">
          Your task journey starts with your first task.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stages.map((stage, index) => (
          <StatTile
            key={stage.name}
            label={stage.name}
            value={formatNumber(stage.value)}
            color={geometry[index].color}
            active={active === index}
            dimmed={active !== null && active !== index}
            onMouseEnter={() => setActive(index)}
            onMouseLeave={() => setActive(null)}
          />
        ))}
      </div>
    </ChartCard>
  )
}