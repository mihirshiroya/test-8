"use client"

import { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"
import { Input } from './input'
import { CustomSelect } from "./custom-select"
import type { SelectOption } from "./custom-select"
import { DateTimePicker } from "./date-time-picker.tsx"
import { PRIORITY_META, useTaskStore } from "../../store/slices/taskSlice.tsx"
import type { Task, TaskPriority, TaskStatus } from "../../store/slices/taskSlice.tsx"

interface TaskModalProps {
  task: Task | null
  createInStatus: TaskStatus
  createInWorkspaceId: string | null   // ← was createInCategory
  onClose: () => void
}

// ── Match Prisma enum casing exactly ──────────────────────────────────────
const PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"]
const STATUSES: TaskStatus[]     = ["TODO", "IN_PROGRESS", "ON_HOLD", "COMPLETED"]

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent",
}
const PRIORITY_OPTIONS: SelectOption<TaskPriority>[] = PRIORITIES.map((p) => ({
  value: p,
  label: PRIORITY_LABELS[p],
  color: PRIORITY_META[p].color,
  bg: PRIORITY_META[p].bg,
}))

const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "To Do", IN_PROGRESS: "In Progress", ON_HOLD: "On Hold", COMPLETED: "Completed",
}

function toInputDate(value: number | null): string {
  if (value == null) return ""
  const d = new Date(value)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fromInputDate(value: string): number | null {
  return value ? new Date(value).getTime() : null
}

export function TaskModal({ task, createInStatus, createInWorkspaceId, onClose }: TaskModalProps) {
  const { addTask, updateTask, workspaces } = useTaskStore()
  const titleRef = useRef<HTMLInputElement>(null)

  const [title, setTitle]           = useState(task?.title ?? "")
  const [description, setDescription] = useState(task?.description ?? "")
  const [priority, setPriority]     = useState<TaskPriority>(task?.priority ?? "MEDIUM")
  const [status, setStatus]         = useState<TaskStatus>(task?.status ?? createInStatus)
  const [workspaceId, setWorkspaceId] = useState<string>(
    task?.workspaceId ?? createInWorkspaceId ?? workspaces[0]?.id ?? ""
  )
  const [startDate, setStartDate]       = useState(toInputDate(task?.startDate ?? null))
  const [deadlineDate, setDeadlineDate] = useState(toInputDate(task?.deadlineDate ?? null))
  const [minutes, setMinutes]           = useState(
    String(Math.max(1, Math.round((task?.plannedDurationSeconds ?? 25 * 60) / 60)))
  )

  useEffect(() => { titleRef.current?.focus() }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const submit = () => {
    if (!title.trim() || !workspaceId) return
    const plannedDurationSeconds = Math.max(1, Number.parseInt(minutes, 10) || 1) * 60
    const dates = { startDate: fromInputDate(startDate), deadlineDate: fromInputDate(deadlineDate) }

    if (task) {
      updateTask(task.id, { title: title.trim(), description: description.trim(), workspaceId, priority, plannedDurationSeconds, ...dates })
    } else {
      addTask({ title: title.trim(), description: description.trim(), priority, plannedDurationSeconds, status, workspaceId, ...dates })
    }
    onClose()
  }

  const fieldClass = "border border-soft bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-ring"
  const labelClass = "flex flex-col gap-1.5"

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="task-sidebar-title">
      <button type="button" aria-label="Close" className="absolute inset-0 h-full w-full cursor-default bg-foreground/45" onClick={onClose} />

      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-soft bg-canvas shadow-2xl">
        <header className="flex items-center justify-between border-b border-soft px-6 py-4">
          <h2 id="task-sidebar-title" className="font-inter! text-lg font-semibold text-foreground">
            {task ? "Edit task" : "Create task"}
          </h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col gap-5">

            {/* Title */}
            <label className={labelClass}>
              <span className="text-sm font-medium text-foreground font-inter!">Title</span>
              <Input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" className={fieldClass} />
            </label>

            {/* Description */}
            <label className={labelClass}>
              <span className="text-sm font-medium text-foreground font-inter!">Description</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Add details (optional)" className={`${fieldClass} resize-none`} />
            </label>

           

            {/* Priority + Duration */}
            <div className="grid grid-cols-2 gap-4">
              <div className={labelClass}>
                <span id="task-priority-label" className="text-sm font-medium text-foreground font-inter!">Priority</span>
                <CustomSelect value={priority} options={PRIORITY_OPTIONS} onChange={setPriority} labelId="task-priority-label" />
              </div>

              <label className={labelClass}>
                <span className="text-sm font-medium text-foreground font-inter!">Planned duration (min)</span>
                <Input type="number" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} className={`${fieldClass} h-9`} />
              </label>
            </div>

            {/* Start date */}
            <div className={labelClass}>
              <span id="task-start-label" className="text-sm font-medium text-foreground font-inter!">Start date</span>
              <DateTimePicker value={startDate} onChange={setStartDate} labelId="task-start-label" placeholder="No start date" />
            </div>

            {/* Deadline */}
            <div className={labelClass}>
              <span id="task-deadline-label" className="text-sm font-medium text-foreground font-inter!">Deadline date</span>
              <DateTimePicker
                value={deadlineDate}
                onChange={setDeadlineDate}
                labelId="task-deadline-label"
                placeholder="No deadline"
                minValue={startDate}
                defaultHour={17}
              />
            </div>
          </div>
        </div>

        <footer className="flex gap-3 border-t border-soft p-6">
          <button type="button" onClick={onClose} className="flex-1 font-inter! border border-soft px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={!title.trim() || !workspaceId}
            className="flex-1 bg-primary px-4 py-2.5 text-sm font-inter! font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40">
            {task ? "Save changes" : "Create task"}
          </button>
        </footer>
      </aside>
    </div>
  )
}

export { TaskModal as TaskSidebar }