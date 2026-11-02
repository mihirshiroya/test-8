export function Shimmer({
  className = "",
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
  return <div className={`shimmer ${className}`} style={style} aria-hidden="true" />
}

export function StatCardSkeleton() {
  return (
    <div className="card-notion p-5">
      <div className="flex items-center gap-3">
        <Shimmer className="h-9 w-9 rounded-notion" />
        <Shimmer className="h-3.5 w-24" />
      </div>
      <Shimmer className="mt-5 h-9 w-28" />
      <Shimmer className="mt-3 h-3 w-32" />
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <div className="card-notion p-6">
      <div className="flex items-center justify-between">
        <div>
          <Shimmer className="h-4 w-40" />
          <Shimmer className="mt-2 h-3 w-24" />
        </div>
        <Shimmer className="h-8 w-32 rounded-full" />
      </div>
      <div className="mt-8 flex h-52 items-end gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex flex-1 items-end justify-center gap-1.5">
            <Shimmer className="w-1/2 rounded-t" style={{ height: `${30 + ((i * 37) % 60)}%` }} />
            <Shimmer className="w-1/2 rounded-t" style={{ height: `${20 + ((i * 53) % 55)}%` }} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card-notion p-6">
      <Shimmer className="h-4 w-32" />
      <div className="mt-5 flex flex-col gap-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Shimmer className="h-5 w-5 rounded-full" />
            <div className="flex-1">
              <Shimmer className="h-3.5 w-3/4" />
              <Shimmer className="mt-2 h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function HeatmapSkeleton() {
  return (
    <div className="card-notion p-6">
      <Shimmer className="h-4 w-36" />
      <Shimmer className="mt-2 h-3 w-48" />
      <div className="mt-6 flex flex-wrap gap-1">
        {Array.from({ length: 18 * 7 }).map((_, i) => (
          <Shimmer key={i} className="h-3.5 w-3.5 rounded-[3px]" />
        ))}
      </div>
    </div>
  )
}
