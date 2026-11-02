"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import type { CalendarViewMode } from "../../lib/tasks"
import { CustomSelect, type SelectOption } from "./custom-select"

const VIEW_OPTIONS: SelectOption<CalendarViewMode>[] = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
]

export function CalendarHeader({
  title,
  view,
  onViewChange,
  onPrev,
  onNext,
  onToday,
}: {
  anchor: Date
  title: string
  view: CalendarViewMode
  onViewChange: (view: CalendarViewMode) => void
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}) {
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
      <h1 className="shrink-0 text-heading-3 text-primary text-balance !font-inter">{title}</h1>

      <div className="flex flex-wrap items-center gap-2">
        <span id="calendar-view-label" className="sr-only">
          Calendar view
        </span>
        <div className="w-[120px]">
          <CustomSelect
            value={view}
            options={VIEW_OPTIONS}
            onChange={onViewChange}
            labelId="calendar-view-label"
            className="bg-canvas font-medium text-primary"
          />
        </div>

        <div className="flex items-center overflow-hidden border border-soft">
          <button
            type="button"
            onClick={onPrev}
            aria-label="Previous"
            className="flex h-[34px] w-9 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={onToday}
            className="h-[34px] border-x border-soft px-3 text-sm font-medium text-primary transition-colors hover:bg-muted"
          >
            Today
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label="Next"
            className="flex h-[34px] w-9 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
