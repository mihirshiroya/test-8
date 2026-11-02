
"use client"

import type { ReactNode } from "react"
import { format } from "date-fns"
import {
  Activity,
  CalendarClock,
  CalendarDays,
  Clock,
  Flag,
  FolderOpen,
  Hourglass,
} from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./sheet"

import { Progress } from "./progress"

import {
  getWorkspaceVisual,
  getPriorityVisual,
  useWorkspaceMap,
  STATUS_CONFIG,
  formatDurationLabel,
  type Task,
} from "../../lib/tasks"

import { cn } from "../../lib/utills"

function getPriorityClass(priority: Task["priority"]) {
  switch (priority?.toLowerCase()) {
    case "urgent":
      return "badge-priority-urgent"
    case "high":
      return "badge-priority-high"
    case "medium":
      return "badge-priority-medium"
    case "low":
      return "badge-priority-low"
    default:
      return "badge-priority-default"
  }
}

function formatDate(
  value: number | null,
  pattern = "EEE, MMM d, yyyy",
) {
  return value ? format(new Date(value), pattern) : null
}

function SectionHeading({
  children,
}: {
  children: ReactNode
}) {
  return (
    <h3 className="text-[15px] font-bold font-inter! Capitalize text-muted-foreground">
      {children}
    </h3>
  )
}

function PropertyRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Clock
  label: string
  children: ReactNode
}) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] items-center gap-3 py-2.5">
      <dt className="flex items-center gap-2 text-xs text-steel font-semibold font-inter!">
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        {label}
      </dt>

      <dd className="min-w-0 truncate text-xs font-bold font-inter! text-foreground">
        {children}
      </dd>
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <span className="min-w-0 truncate text-xs font-bold font-inter! text-foreground">
      {children}
    </span>
  )
}

export function TaskDetailSheet({
  task,
  open,
  onOpenChange,
}: {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const workspaceMap = useWorkspaceMap()

  if (!task) return null

  const workspace = getWorkspaceVisual(
    workspaceMap.get(task.workspaceId),
  )

  const status = STATUS_CONFIG[task.status]
  const priorityLabel = getPriorityVisual(task.priority).label

  const planned = task.plannedDurationSeconds
  const spent = task.actualDurationSeconds

  const progress =
    planned > 0
      ? Math.min(100, Math.round((spent / planned) * 100))
      : 0

  const totalSegments = 10
  const completedSegments = Math.round(
    (progress / 100) * totalSegments,
  )

  const overrun = planned > 0 && spent > planned

  const deadline = formatDate(task.deadlineDate)
  const start = formatDate(
    task.startDate,
    "EEE, MMM d · h:mm a",
  )
  const created = formatDate(task.createdAt, "MMM d, yyyy")
  const completed = formatDate(
    task.completedAt,
    "MMM d, yyyy · h:mm a",
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 bg-canvas p-0 sm:max-w-md"
      >
        <SheetHeader className="gap-3 border-b border-soft p-5 pr-12">
          <SheetTitle className="text-lg font-bold leading-snug text-balance capitalize font-inter!">
            {task.title}
          </SheetTitle>

          <SheetDescription className="sr-only">
            Task details for {task.title}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-5">
          <section
            className="flex flex-col gap-2"
            aria-labelledby="task-description"
          >
            <SectionHeading>
              <span id="task-description">Description</span>
            </SectionHeading>

            <p
              className={cn(
                " text-sm text-secondary font-semibold"
              )}
            >
              {task.description || "No description provided."}
            </p>
          </section>

          <section
            className="flex flex-col gap-1"
            aria-labelledby="task-properties"
          >
            <SectionHeading>
              <span id="task-properties">Details</span>
            </SectionHeading>

            <dl className="">
              <PropertyRow icon={Activity} label="Status">
                {status.label}
              </PropertyRow>

              <PropertyRow icon={Flag} label="Priority">
                <span
                  className={cn(
                    "px-2 py-0.5 text-[11px]",
                    getPriorityClass(task.priority),
                  )}
                >
                  {priorityLabel}
                </span>
              </PropertyRow>

              <PropertyRow icon={FolderOpen} label="Workspace">
                {workspace.label}
              </PropertyRow>

              <PropertyRow icon={CalendarClock} label="Start">
                {start ?? <Empty>Not scheduled</Empty>}
              </PropertyRow>

              <PropertyRow icon={CalendarDays} label="Deadline">
                {deadline ?? <Empty>No deadline</Empty>}
              </PropertyRow>
            </dl>
          </section>

          <section
            className="flex flex-col gap-3"
            aria-labelledby="task-time"
          >
            <SectionHeading>
              <span id="task-time">Time tracking</span>
            </SectionHeading>

            <div className="flex flex-col gap-3">
  <div className="grid grid-cols-2 gap-4">
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-steel font-semibold">
          Planned
        </span>

        <Clock
          className="size-3.5 text-steel"
          aria-hidden="true"
        />
      </div>

      <span className="text-base font-semibold tabular-nums text-foreground">
        {planned > 0 ? formatDurationLabel(planned) : "—"}
      </span>
    </div>

    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-steel font-semibold">
          Spent
        </span>

        <Hourglass
          className="size-3.5 text-steel"
          aria-hidden="true"
        />
      </div>

      <span className="text-base font-semibold tabular-nums text-foreground">
        {formatDurationLabel(spent)}
      </span>
    </div>
  </div>

  {planned > 0 && (
    <div className="flex flex-col gap-2">
      <Progress
        total={totalSegments}
        completed={completedSegments}
      />
    </div>
  )}
</div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
