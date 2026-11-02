import { useCallback, useId, useRef, useState } from "react"
import type { KeyboardEvent } from "react"
import { Check, ChevronDown } from "lucide-react"
import { AnchoredPopover } from "./popup"

export interface SelectOption<T extends string> {
  value: T
  label: string
  color?: string
  bg?: string
  description?: string
}

interface CustomSelectProps<T extends string> {
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  labelId?: string
  className?: string
}

export function CustomSelect<T extends string>({ value, options, onChange, labelId, className }: CustomSelectProps<T>) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)))

  const selected = options.find((o) => o.value === value) ?? options[0]
  const close = useCallback(() => setOpen(false), [])

  const openList = () => {
    setActiveIndex(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(true)
  }

  const choose = (index: number) => {
    const option = options[index]
    if (!option) return
    onChange(option.value)
    setOpen(false)
    triggerRef.current?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); openList() }
      return
    }
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); setActiveIndex((i) => (i + 1) % options.length); break
      case "ArrowUp": e.preventDefault(); setActiveIndex((i) => (i - 1 + options.length) % options.length); break
      case "Home": e.preventDefault(); setActiveIndex(0); break
      case "End": e.preventDefault(); setActiveIndex(options.length - 1); break
      case "Enter":
      case " ": e.preventDefault(); choose(activeIndex); break
      case "Tab": setOpen(false); break
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelId}
        aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={`flex h-9 w-full items-center justify-between gap-2 border border-soft bg-background px-3 text-left text-sm text-foreground outline-none transition hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring ${open ? "ring-2 ring-ring" : ""} ${className ?? ""}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.color && (
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: selected.color }} />
          )}
          <span className="truncate">{selected?.label}</span>
        </span>
        <ChevronDown size={16} aria-hidden className={`shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnchoredPopover open={open} anchorRef={triggerRef} onClose={close} matchWidth className="p-1">
        <ul id={listId} role="listbox" aria-labelledby={labelId} className="flex flex-col gap-0.5">
          {options.map((option, index) => {
            const isSelected = option.value === value
            const isActive = index === activeIndex
            return (
              <li
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={isSelected}
                onPointerEnter={() => setActiveIndex(index)}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => choose(index)}
                className={`flex cursor-pointer items-center gap-2.5 px-2.5 py-2 text-sm transition-colors ${isActive ? "bg-muted" : ""}`}
              >
                {option.color && (
                  <span
                    aria-hidden
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-full"
                    style={{ backgroundColor: option.bg ?? "transparent" }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: option.color }} />
                  </span>
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={`truncate ${isSelected ? "font-medium" : ""}`}>{option.label}</span>
                  {option.description && <span className="truncate text-xs text-muted-foreground">{option.description}</span>}
                </span>
                {isSelected && <Check size={15} aria-hidden className="shrink-0 text-primary" />}
              </li>
            )
          })}
        </ul>
      </AnchoredPopover>
    </>
  )
}
