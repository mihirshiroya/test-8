import { useCallback, useEffect, useId, useRef, useState } from "react"
import {
  addDays, addMonths, endOfMonth, endOfWeek, format, isAfter, isBefore, isSameDay, isSameMonth,
  isToday, isValid, parse, startOfDay, startOfMonth, startOfWeek, subMonths,
} from "date-fns"
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock, X } from "lucide-react"
import { AnchoredPopover } from "./popup"

// Value formats match the native datetime-local / date inputs.
const DATETIME_FORMAT = "yyyy-MM-dd'T'HH:mm"
const DATE_FORMAT = "yyyy-MM-dd"
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1)
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)

interface DateTimePickerProps {
  value: string
  onChange: (value: string) => void
  labelId?: string
  placeholder?: string
  minValue?: string
  maxValue?: string
  defaultHour?: number
  mode?: "datetime" | "date"
  clearable?: boolean
  className?: string
  triggerClassName?: string
  displayFormat?: string
  showChevron?: boolean
}

function parseValue(value: string, valueFormat: string): Date | null {
  if (!value) return null
  const d = parse(value, valueFormat, new Date())
  return isValid(d) ? d : null
}

function buildMonthGrid(month: Date): Date[] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
  const days: Date[] = []
  for (let d = start; !isBefore(end, d); d = addDays(d, 1)) days.push(d)
  return days
}

export function DateTimePicker({
  value,
  onChange,
  labelId,
  placeholder,
  minValue,
  maxValue,
  defaultHour = 9,
  mode = "datetime",
  clearable = true,
  className = "",
  triggerClassName = "",
  displayFormat = "EEE, MMM d, yyyy",
  showChevron = false,
}: DateTimePickerProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogId = useId()
  const [open, setOpen] = useState(false)

  const dateOnly = mode === "date"
  const valueFormat = dateOnly ? DATE_FORMAT : DATETIME_FORMAT
  const selected = parseValue(value, valueFormat)
  const minDate = parseValue(minValue ?? "", valueFormat)
  const maxDate = parseValue(maxValue ?? "", valueFormat)
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selected ?? new Date()))
  const [draft, setDraft] = useState<Date | null>(selected)

  useEffect(() => {
    if (!open) return
    const current = parseValue(value, valueFormat)
    setDraft(current)
    setViewMonth(startOfMonth(current ?? minDate ?? new Date()))
    // Only re-sync when the popover opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const close = useCallback(() => setOpen(false), [])

  function isDisabledDay(day: Date) {
    if (minDate && isBefore(day, startOfDay(minDate))) return true
    if (maxDate && isAfter(startOfDay(day), startOfDay(maxDate))) return true
    return false
  }

  const hour24 = draft?.getHours() ?? defaultHour
  const minute = draft?.getMinutes() ?? 0
  const isPM = hour24 >= 12
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  const minuteOptions = MINUTES.includes(minute) ? MINUTES : [...MINUTES, minute].sort((a, b) => a - b)

  const withTime = (base: Date, h: number, m: number) => {
    const d = new Date(base)
    d.setHours(h, m, 0, 0)
    return d
  }

  const pickDay = (day: Date) => {
    if (dateOnly) {
      onChange(format(day, DATE_FORMAT))
      setOpen(false)
      triggerRef.current?.focus()
      return
    }
    setDraft(withTime(day, hour24, minute))
  }
  const setHour12 = (h: number) => setDraft(withTime(draft ?? startOfDay(new Date()), (h % 12) + (isPM ? 12 : 0), minute))
  const setMinute = (m: number) => setDraft(withTime(draft ?? startOfDay(new Date()), hour24, m))
  const setMeridiem = (pm: boolean) => {
    if (pm === isPM) return
    setDraft(withTime(draft ?? startOfDay(new Date()), (hour24 % 12) + (pm ? 12 : 0), minute))
  }

  const commit = () => {
    onChange(draft ? format(draft, valueFormat) : "")
    setOpen(false)
    triggerRef.current?.focus()
  }

  const clear = () => {
    onChange("")
    setOpen(false)
  }

  const jumpToNow = () => {
    const now = new Date()
    if (dateOnly) {
      if (!isDisabledDay(now)) pickDay(now)
      return
    }
    const rounded = withTime(now, now.getHours(), Math.ceil(now.getMinutes() / 5) * 5 % 60)
    if (now.getMinutes() > 55) rounded.setHours(rounded.getHours() + 1)
    setDraft(rounded)
    setViewMonth(startOfMonth(rounded))
  }

  const days = buildMonthGrid(viewMonth)
  const draftTooEarly = !!(draft && minDate && isBefore(draft, minDate))
  const draftTooLate = !!(draft && maxDate && isAfter(draft, maxDate))
  const draftInvalid = draftTooEarly || draftTooLate

  return (
    <>
      <div className={`relative ${className}`}>
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={dialogId}
          aria-labelledby={labelId}
          onClick={() => setOpen((o) => !o)}
          className={`flex h-9 w-full items-center gap-2.5 border border-soft bg-background px-3 ${clearable ? "pr-9" : "pr-3"} text-left text-sm outline-none transition hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring ${open ? "ring-2 ring-ring" : ""} ${triggerClassName}`}
        >
          <CalendarDays size={16} aria-hidden className="shrink-0 text-steel" />
          {selected ? (
            <span className="flex min-w-0 items-center gap-2 truncate text-foreground">
              <span>{format(selected, displayFormat)}</span>
              {!dateOnly && (
                <>
                  <span aria-hidden className="h-3.5 w-px bg-border" />
                  <span className="text-muted-foreground">{format(selected, "h:mm a")}</span>
                </>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder ?? (dateOnly ? "Pick a date" : "Pick date & time")}</span>
          )}
          {showChevron && (
            <ChevronDown
              size={14}
              aria-hidden
              className={`ml-auto shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            />
          )}
        </button>
        {selected && clearable && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear date"
            className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <AnchoredPopover open={open} anchorRef={triggerRef} onClose={close} id={dialogId} className="w-[min(14.5rem,calc(100vw-1rem))]">
        <div role="dialog" aria-label={dateOnly ? "Choose date" : "Choose date and time"} className="flex flex-col">
          <div className="flex items-center justify-between px-2 pb-1 pt-2">
            <button type="button" onClick={() => setViewMonth((m) => subMonths(m, 1))} aria-label="Previous month"
              className="grid h-6 w-6 place-items-center text-muted-foreground hover:bg-muted hover:text-foreground">
              <ChevronLeft size={14} />
            </button>
            <span className="font-inter! text-xs font-semibold" aria-live="polite">{format(viewMonth, "MMMM yyyy")}</span>
            <button type="button" onClick={() => setViewMonth((m) => addMonths(m, 1))} aria-label="Next month"
              className="grid h-6 w-6 place-items-center text-muted-foreground hover:bg-muted hover:text-foreground">
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-7 px-2 text-center text-[10px] font-medium uppercase text-muted-foreground">
            {WEEKDAYS.map((d) => <span key={d} className="py-0.5">{d}</span>)}
          </div>

          <div role="grid" className="grid grid-cols-7 px-2 pb-2">
            {days.map((day) => {
              const current = dateOnly ? selected : draft
              const isSelectedDay = current ? isSameDay(day, current) : false
              const outside = !isSameMonth(day, viewMonth)
              const disabled = isDisabledDay(day)
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  role="gridcell"
                  disabled={disabled}
                  aria-selected={isSelectedDay}
                  aria-label={format(day, "EEEE, MMMM d, yyyy")}
                  onClick={() => pickDay(day)}
                  className={`relative grid h-7 place-items-center text-xs tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                    isSelectedDay
                      ? "bg-primary font-semibold text-primary-foreground"
                      : `hover:bg-muted ${outside ? "text-muted-foreground/60" : "text-foreground"}`
                  }`}
                >
                  {format(day, "d")}
                  {isToday(day) && !isSelectedDay && (
                    <span aria-hidden className="absolute bottom-0.5 h-0.5 w-0.5 rounded-full bg-primary" />
                  )}
                </button>
              )
            })}
          </div>

          {!dateOnly && (
          <div className="border-t border-soft px-2 py-2">
            <div className="flex items-stretch gap-1.5">
              <Clock size={12} aria-hidden className="mt-1 shrink-0 text-muted-foreground" />
              <TimeColumn label="Hour" options={HOURS} value={hour12} onSelect={setHour12} render={(h) => String(h)} />
              <TimeColumn label="Minute" options={minuteOptions} value={minute} onSelect={setMinute} render={(m) => String(m).padStart(2, "0")} />
              <div role="radiogroup" aria-label="AM or PM" className="flex w-10 flex-col border border-soft">
                {[false, true].map((pm) => (
                  <button
                    key={pm ? "pm" : "am"}
                    type="button"
                    role="radio"
                    aria-checked={isPM === pm}
                    onClick={() => setMeridiem(pm)}
                    className={`flex-1 text-[10px] font-semibold transition-colors ${isPM === pm ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                  >
                    {pm ? "PM" : "AM"}
                  </button>
                ))}
              </div>
            </div>
            {draftInvalid && (
              <p role="alert" className="mt-1.5 text-[11px] text-destructive">
                {draftTooEarly ? "Must be after the start date." : "Must be before the latest allowed date."}
              </p>
            )}
          </div>
          )}

          <div className="flex items-center gap-1 border-t border-soft px-2 py-1.5">
            <button type="button" onClick={jumpToNow} className="px-1.5 py-1 text-[11px] font-medium text-primary hover:bg-muted">
              {dateOnly ? "Today" : "Now"}
            </button>
            {clearable && (
              <button
                type="button"
                onClick={dateOnly ? clear : () => setDraft(null)}
                className="px-1.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted"
              >
                Clear
              </button>
            )}
            {!dateOnly && (
            <button
              type="button"
              onClick={commit}
              disabled={draftInvalid}
              className="ml-auto bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
            >
              Done
            </button>
            )}
          </div>
        </div>
      </AnchoredPopover>
    </>
  )
}

interface TimeColumnProps {
  label: string
  options: number[]
  value: number
  onSelect: (value: number) => void
  render: (value: number) => string
}

function TimeColumn({ label, options, value, onSelect, render }: TimeColumnProps) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const list = listRef.current
    const active = list?.querySelector<HTMLElement>('[aria-checked="true"]')
    if (list && active) list.scrollTop = active.offsetTop - list.clientHeight / 2 + active.offsetHeight / 2
  }, [value])

  return (
    <div
      ref={listRef}
      role="radiogroup"
      aria-label={label}
      className="flex h-[4.5rem] flex-1 snap-y flex-col overflow-y-auto border border-soft no-scrollbar"
    >
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          role="radio"
          aria-checked={opt === value}
          onClick={() => onSelect(opt)}
          className={`shrink-0 snap-center py-0.5 text-xs tabular-nums transition-colors ${
            opt === value ? "bg-primary font-semibold text-primary-foreground" : "text-foreground hover:bg-muted"
          }`}
        >
          {render(opt)}
        </button>
      ))}
    </div>
  )
}
