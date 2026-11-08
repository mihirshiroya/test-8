import type { ComparisonMode } from "@/lib/analytics-data"

const OPTIONS: { value: ComparisonMode; label: string }[] = [
  { value: "today", label: "Day" },
  { value: "week", label: "Week" },
]

export function ComparisonToggle({
  mode,
  onChange,
}: {
  mode: ComparisonMode
  onChange: (mode: ComparisonMode) => void
}) {
  return (
    <div role="tablist" aria-label="Comparison period" className="kumo-segmented">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={mode === opt.value}
          onClick={() => onChange(opt.value)}
          className="kumo-segmented-item"
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
