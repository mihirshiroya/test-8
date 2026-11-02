"use client"

import { useEffect, useState } from "react"
import { HOUR_HEIGHT } from "../../lib/tasks"

function nowMinutes() {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

export function CurrentTimeIndicator() {
  const [minutes, setMinutes] = useState<number | null>(null)

  useEffect(() => {
    setMinutes(nowMinutes())
    const id = setInterval(() => setMinutes(nowMinutes()), 60_000)
    return () => clearInterval(id)
  }, [])

  if (minutes === null) return null

  const top = (minutes / 60) * HOUR_HEIGHT

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
      style={{ top }}
      aria-hidden="true"
    >
      <span className="-ml-[3px] size-[7px] shrink-0 rounded-full bg-red-600" />
      <span className="h-px flex-1 bg-red-600/70" />
    </div>
  )
}
