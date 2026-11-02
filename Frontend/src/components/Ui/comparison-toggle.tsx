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
    <div
      role="tablist"
      aria-label="Comparison period"
      className="inline-flex items-center gap-1 rounded-notion-full border border-color p-1"
    >
      {OPTIONS.map((opt) => {
        const active = mode === opt.value
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`rounded-notion-full px-3.5 py-1.5 text-body-sm-medium transition-colors ${
              active ? "bg-primary text-primary shadow-[var(--shadow-subtle)]" : "text-steel hover:text-primary"
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
