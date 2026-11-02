
import { useId } from "react"
import type { LucideIcon } from "lucide-react"

export type ProfileStat = {
  label: string
  value: string
  hint?: string
  icon: LucideIcon
}

export function ProfileStatCard({
  stat,
  index = 0,
}: {
  stat: ProfileStat
  index?: number
}) {
  const Icon = stat.icon
  const gradientId = useId().replace(/:/g, "")
  const gradient = `profile-stat-gradient-${gradientId}`

  return (
    <article
      style={{ animationDelay: `${index * 60}ms` }}
      className="
        group relative isolate min-w-0 overflow-hidden
        border border-soft bg-background p-5 sm:p-6
        transition-all duration-300
        hover:-translate-y-0.5
      "
    >
      {/* Ambient corner glow */}
      <div
        aria-hidden="true"
        className="
          pointer-events-none absolute -right-16 -top-16
          h-40 w-40 rounded-full
          bg-[#65ABC4]/10 blur-3xl
          transition-all duration-700
          group-hover:scale-125 group-hover:bg-[#65ABC4]/20
        "
      />

      {/* Top hairline sheen */}
      <div
        aria-hidden="true"
        className="
          pointer-events-none absolute inset-x-0 top-0 h-px
          bg-gradient-to-r from-transparent via-black/10 to-transparent
          transition-opacity duration-500
          group-hover:via-black/20
          dark:via-white/20 dark:group-hover:via-white/40
        "
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between gap-3">
        <p
          className="
            min-w-0 text-sm font-medium tracking-tight
            text-secondary transition-colors
            group-hover:text-foreground
          "
        >
          {stat.label}
        </p>

        <Icon
          aria-hidden="true"
          className="
            size-5 shrink-0 text-secondary opacity-50
            transition-all duration-300
            group-hover:scale-110 group-hover:text-[#65ABC4]
            group-hover:opacity-100
          "
        />
      </div>

      {/* Main value */}
      <div className="relative z-10 mt-5 min-w-0">
        <p
          title={stat.value}
          className="
            truncate text-3xl font-semibold tracking-tight
            text-foreground tabular-nums
          "
        >
          {stat.value}
        </p>

        {stat.hint && (
          <p
            title={stat.hint}
            className="mt-2 truncate text-xs text-secondary"
          >
            {stat.hint}
          </p>
        )}
      </div>

      {/* Decorative chart */}
      <div
        aria-hidden="true"
        className="
          pointer-events-none absolute bottom-0 right-0
          h-16 w-24 opacity-70 transition-opacity duration-300
          group-hover:opacity-100 sm:h-20 sm:w-28
        "
      >
        <svg
          viewBox="0 0 100 36"
          fill="none"
          className="h-full w-full"
        >
          <defs>
            <linearGradient
              id={gradient}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor="#65ABC4"
                stopOpacity="0.3"
              />
              <stop
                offset="100%"
                stopColor="#65ABC4"
                stopOpacity="0"
              />
            </linearGradient>
          </defs>

          <path
            d="
              M 0 28
              C 16 28, 24 32, 38 20
              C 52 10, 60 22, 74 12
              C 84 5, 92 8, 100 4
              L 100 36 L 0 36 Z
            "
            fill={`url(#${gradient})`}
          />

          <path
            d="
              M 0 28
              C 16 28, 24 32, 38 20
              C 52 10, 60 22, 74 12
              C 84 5, 92 8, 100 4
            "
            pathLength="100"
            strokeDasharray="100"
            strokeDashoffset="0"
            stroke="#65ABC4"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="
              transition-all duration-500
              group-hover:[stroke-dashoffset:100]
            "
          />
        </svg>
      </div>
    </article>
  )
}
