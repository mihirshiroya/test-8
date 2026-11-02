import {
  ArrowRightLeft,
  CalendarClock,
  CircleCheck,
  Flag,
  Pencil,
  Plus,
  Timer,
  Trash2,
  type LucideIcon,
} from "lucide-react"
import type { Activity } from "../Ui/analytics-data"
import { ThemedSvg } from "../../lib/svg-theme"
import noResultsRaw from "../../assets/31-no-results.svg?raw"

type ActivityCategory =
  | "created"
  | "completed"
  | "focus"
  | "status"
  | "priority"
  | "deadline"
  | "updated"
  | "deleted"

const CATEGORY_BY_TYPE: Record<string, ActivityCategory> = {
  TASK_CREATED: "created",
  TASK_COMPLETED: "completed",
  TASK_STARTED: "focus",
  SESSION_STARTED: "focus",
  SESSION_COMPLETED: "focus",
  STATUS_CHANGED: "status",
  PRIORITY_CHANGED: "priority",
  DEADLINE_CHANGED: "deadline",
  TASK_UPDATED: "updated",
  TASK_DELETED: "deleted",
}

const CATEGORY_STYLES: Record<
  ActivityCategory,
  { icon: LucideIcon; badge: string; iconColor: string }
> = {
  created: {
    icon: Plus,
    badge: "group-hover:border-blue-500/40 group-hover:bg-blue-500/10",
    iconColor: "group-hover:text-blue-500",
  },
  completed: {
    icon: CircleCheck,
    badge: "group-hover:border-emerald-500/40 group-hover:bg-emerald-500/10",
    iconColor: "group-hover:text-emerald-500",
  },
  focus: {
    icon: Timer,
    badge: "group-hover:border-amber-500/40 group-hover:bg-amber-500/10",
    iconColor: "group-hover:text-amber-500",
  },
  status: {
    icon: ArrowRightLeft,
    badge: "group-hover:border-sky-500/40 group-hover:bg-sky-500/10",
    iconColor: "group-hover:text-sky-500",
  },
  priority: {
    icon: Flag,
    badge: "group-hover:border-orange-500/40 group-hover:bg-orange-500/10",
    iconColor: "group-hover:text-orange-500",
  },
  deadline: {
    icon: CalendarClock,
    badge: "group-hover:border-purple-500/40 group-hover:bg-purple-500/10",
    iconColor: "group-hover:text-purple-500",
  },
  updated: {
    icon: Pencil,
    badge: "group-hover:border-slate-500/40 group-hover:bg-slate-500/10",
    iconColor: "group-hover:text-slate-500",
  },
  deleted: {
    icon: Trash2,
    badge: "group-hover:border-red-500/40 group-hover:bg-red-500/10",
    iconColor: "group-hover:text-red-500",
  },
}

function categoryOf(item: Activity): ActivityCategory {
  const byType = item.type ? CATEGORY_BY_TYPE[item.type] : undefined
  if (byType) return byType
  if (item.kind === "created" || item.kind === "completed" || item.kind === "focus") {
    return item.kind
  }
  return item.kind === "milestone" ? "deleted" : "updated"
}

export function RecentActivity({
  items,
  variant = "card",
}: {
  items: Activity[]
  variant?: "card" | "panel"
}) {
  const isPanel = variant === "panel"

  return (
    <div
      className={
        isPanel
          ? "animate-fadeIn flex h-full flex-col"
          : "border border-soft animate-fadeIn flex h-full flex-col p-6"
      }
    >
      {!isPanel && <h3 className="text-heading-5 text-primary">Recent activity</h3>}
      {items.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center py-8 text-center">
          <ThemedSvg
            raw={noResultsRaw}
            ariaLabel="No recent activity"
            className="mb-4 h-28 w-28"
          />
          <p className="text-body-sm text-steel">
            No activity yet. Create or start a task to see it here.
          </p>
        </div>
      ) : (
        <ol
          className={
            isPanel
              ? "relative flex flex-col"
              : "relative mt-5 flex max-h-[360px] flex-col no-scrollbar overflow-y-auto pr-2"
          }
        >
          {items.map((item, i) => {
            const style = CATEGORY_STYLES[categoryOf(item)]
            const Icon = style.icon
            const isFirst = i === 0
            const isLast = i === items.length - 1

            return (
              <li
                key={item.id}
                className="group relative flex gap-3 pb-5 last:pb-0 transition-all duration-300"
                style={{
                  animation: `fadeInUp 400ms cubic-bezier(0.16, 1, 0.3, 1) both`,
                  animationDelay: `${i * 80}ms`,
                }}
              >
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className="absolute left-[15px] top-8 h-[calc(100%-1.75rem)] w-px bg-[var(--color-border)] origin-top transition-all duration-500 group-hover:bg-primary/40 group-hover:w-[1.5px]"
                    style={{
                      animation: `growDown 500ms ease-out both`,
                      animationDelay: `${i * 80 + 100}ms`,
                    }}
                  />
                )}

                <div className="relative z-10 shrink-0">
                  {isFirst && (
                    <span className="absolute inset-0 rounded-notion-full bg-primary/20 animate-ping pointer-events-none opacity-75" />
                  )}

                  <span
                    className={`relative skew-x-3 group-hover:skew-x-0 grid h-8 w-8 place-items-center rounded-notion-full border border-soft bg-surface text-steel shadow-sm transition-all duration-300 ease-out group-hover:scale-110 group-hover:shadow-md ${style.badge}`}
                  >
                    <Icon
                      className={`h-4 w-4 transition-all duration-300 ease-out group-hover:rotate-12 group-hover:scale-110 ${style.iconColor}`}
                    />
                  </span>
                </div>

                <div className="min-w-0 flex-1 pt-0.5 transition-transform duration-200 group-hover:translate-x-0.5">
                  <p className="text-body-sm !font-inter text-primary transition-colors duration-200 group-hover:text-primary-hover">
                    {item.text}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-caption text-stone">
                    <span>{item.meta}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.ago}</span>
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
