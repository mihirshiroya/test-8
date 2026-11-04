import { useState, type KeyboardEvent } from "react"
import { X } from "lucide-react"

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)

const CODE_NAMES: Record<string, string> = {
  Space: "Space",
  Enter: "Enter",
  Tab: "Tab",
  Backspace: "Backspace",
  Delete: "Delete",
  Insert: "Insert",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Minus: "-",
  Equal: "=",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Semicolon: ";",
  Quote: "'",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Backquote: "`",
}

/** Maps a keydown to a Tauri accelerator such as "CommandOrControl+Alt+F". */
function toAccelerator(event: KeyboardEvent): string | null {
  const { code } = event
  let key: string | undefined
  if (/^Key[A-Z]$/.test(code)) key = code.slice(3)
  else if (/^Digit[0-9]$/.test(code)) key = code.slice(5)
  else if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) key = code
  else if (/^Numpad[0-9]$/.test(code)) key = `Num${code.slice(6)}`
  else key = CODE_NAMES[code]
  if (!key) return null

  const parts: string[] = []
  if (IS_MAC) {
    if (event.metaKey) parts.push("CommandOrControl")
    if (event.ctrlKey) parts.push("Control")
  } else {
    if (event.ctrlKey) parts.push("CommandOrControl")
    if (event.metaKey) parts.push("Super")
  }
  if (event.altKey) parts.push("Alt")
  if (event.shiftKey) parts.push("Shift")
  // A global shortcut without a modifier would swallow normal typing.
  const isFunctionKey = /^F\d+$/.test(key)
  if (parts.length === 0 && !isFunctionKey) return null
  return [...parts, key].join("+")
}

function formatAccelerator(accelerator: string): string {
  if (!accelerator) return "Not set"
  return accelerator
    .split("+")
    .map((part) => {
      if (part === "CommandOrControl") return IS_MAC ? "Cmd" : "Ctrl"
      if (part === "Alt") return IS_MAC ? "Option" : "Alt"
      return part
    })
    .join(" + ")
}

export function ShortcutInput({
  id,
  value,
  onChange,
  invalid,
}: {
  id: string
  value: string
  onChange: (accelerator: string) => void
  invalid?: boolean
}) {
  const [recording, setRecording] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!recording) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        setRecording(true)
      }
      return
    }
    event.preventDefault()
    event.stopPropagation()
    if (event.key === "Escape") {
      setRecording(false)
      setHint(null)
      return
    }
    if (["Control", "Shift", "Alt", "Meta"].includes(event.key)) return
    const accelerator = toAccelerator(event)
    if (!accelerator) {
      setHint("Include Ctrl, Alt or Shift so normal typing is not captured.")
      return
    }
    setHint(null)
    setRecording(false)
    onChange(accelerator)
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <button
          id={id}
          type="button"
          onClick={() => setRecording((r) => !r)}
          onKeyDown={onKeyDown}
          onBlur={() => setRecording(false)}
          aria-label={recording ? "Press the new shortcut, or Escape to cancel" : `Shortcut: ${formatAccelerator(value)}. Press Enter to change.`}
          className={`min-w-44 rounded-lg border px-3 py-1.5 text-left font-mono text-sm transition-colors ${
            recording
              ? "border-primary bg-primary-soft text-foreground ring-2 ring-primary/20"
              : invalid
                ? "border-destructive text-foreground"
                : "border-border bg-background text-foreground hover:bg-muted"
          }`}
        >
          {recording ? "Press keys..." : formatAccelerator(value)}
        </button>
        {value && !recording && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Clear shortcut"
            title="Disable this shortcut"
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
