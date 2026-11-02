"use client"

import { format } from "date-fns"
import { HOUR_HEIGHT, GRID_END_HOUR, GRID_START_HOUR } from "../../lib/tasks"

export function TimeGutter() {
  const hours = Array.from(
    { length: GRID_END_HOUR - GRID_START_HOUR },
    (_, i) => i + GRID_START_HOUR
  )

  return (
    <div
      className="w-12 shrink-0 border-r border-soft sm:w-16"
      style={{ height: HOUR_HEIGHT * hours.length }}
    >
      {hours.map((h) => (
        <div key={h} className="relative" style={{ height: HOUR_HEIGHT }}>
          {h !== 0 && (
            <span className="absolute -top-2 right-1.5 text-[10px] font-inter! font-medium text-steel sm:right-2 sm:text-[11px]">
              {format(new Date(2000, 0, 1, h), "h a")}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
