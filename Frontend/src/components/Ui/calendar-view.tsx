"use client"

import { addDays, addMonths, addWeeks, format, subDays, subMonths, subWeeks } from "date-fns"
import { useState } from "react"
import { CalendarHeader } from "./calendar-header"
import { MonthGrid } from "./month-grid"
import { MobileAgenda } from "./mobile-agenda"
import { WeekView } from "./week-view"
import { DayView } from "./day-view"
import { TaskDetailSheet } from "./task-detail-sheet"
import { DayTasksSheet } from "./day-tasks-sheet"
import { formatWeekRange, type CalendarViewMode, type Task } from "../../lib/tasks"





export function CalendarView() {
  const [view, setView] = useState<CalendarViewMode>("month")
  const [anchor, setAnchor] = useState(() => new Date())
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskSheetOpen, setTaskSheetOpen] = useState(false)
  const [dayView, setDayView] = useState<{ date: Date; tasks: Task[] } | null>(null)
  const [daySheetOpen, setDaySheetOpen] = useState(false)

  function handleSelectTask(task: Task) {
    setSelectedTask(task)
    setTaskSheetOpen(true)
  }

  function handleMore(date: Date, tasks: Task[]) {
    setDayView({ date, tasks })
    setDaySheetOpen(true)
  }

  function handlePrev() {
    setAnchor((d) =>
      view === "month" ? subMonths(d, 1) : view === "week" ? subWeeks(d, 1) : subDays(d, 1)
    )
  }

  function handleNext() {
    setAnchor((d) =>
      view === "month" ? addMonths(d, 1) : view === "week" ? addWeeks(d, 1) : addDays(d, 1)
    )
  }

  function handleViewChange(next: CalendarViewMode) {
    setView(next)
  }

  const title =
  view === "month"
    ? format(anchor, "MMM yyyy")
    : view === "week"
      ? formatWeekRange(anchor)
      : format(anchor, "EEE, MMM d")

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <CalendarHeader
        anchor={anchor}
        title={title}
        view={view}
        onViewChange={handleViewChange}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={() => setAnchor(new Date())}
      />

      {view === "month" && (
        <>
          <div className="hidden min-h-0 flex-1 sm:flex">
            <MonthGrid monthAnchor={anchor} onSelectTask={handleSelectTask} onMore={handleMore} />
          </div>
          <div className="flex min-h-0 flex-1 sm:hidden">
            <MobileAgenda monthAnchor={anchor} onSelectTask={handleSelectTask} />
          </div>
        </>
      )}

      {view === "week" && <WeekView anchor={anchor} onSelectTask={handleSelectTask} />}

      {view === "day" && <DayView anchor={anchor} onSelectTask={handleSelectTask} />}

      <TaskDetailSheet
        task={selectedTask}
        open={taskSheetOpen}
        onOpenChange={setTaskSheetOpen}
      />
      <DayTasksSheet
        date={dayView?.date ?? null}
        tasks={dayView?.tasks ?? []}
        open={daySheetOpen}
        onOpenChange={setDaySheetOpen}
        onSelectTask={(task) => {
          setDaySheetOpen(false)
          handleSelectTask(task)
        }}
      />
    </div>
  )
}
