export const HEATMAP_LEVELS = [
  'var(--heatmap-empty)',
  'var(--heatmap-low)',
  'var(--heatmap-medium)',
  'var(--heatmap-high)',
  'var(--heatmap-peak)',
]

export function heatmapBackground(minutes: number, max: number) {
  if (minutes <= 0) return HEATMAP_LEVELS[0]
  return HEATMAP_LEVELS[Math.min(4, Math.max(1, Math.ceil((minutes / max) * 4)))]
}

export function HeatmapLegend() {
  return (
    <div className="heatmap-legend" aria-hidden="true">
      <span>Less</span>
      {HEATMAP_LEVELS.map((background) => (
        <span key={background} className="heatmap-dot" style={{ background }} />
      ))}
      <span>More</span>
    </div>
  )
}
