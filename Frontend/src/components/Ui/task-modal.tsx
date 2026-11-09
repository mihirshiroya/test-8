"use client"

import { useEffect, useRef, useState } from "react"
import { AppDialog, AppDialogButton, appDialogInputClass } from './app-dialog'
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

  const fieldClass = appDialogInputClass
  const labelClass = "flex flex-col gap-1.5"

  return (
    <AppDialog
      open
      title={task ? 'Edit task' : 'Create task'}
      onClose={onClose}
      onSubmit={event => { event.preventDefault(); submit() }}
      size="lg"
      footer={<>
        <AppDialogButton variant="secondary" onClick={onClose}>Cancel</AppDialogButton>
        <AppDialogButton type="submit" disabled={!title.trim() || !workspaceId}>
          {task ? 'Save changes' : 'Create task'}
        </AppDialogButton>
      </>}
    >
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
    </AppDialog>
  )
}

export { TaskModal as TaskSidebar }
