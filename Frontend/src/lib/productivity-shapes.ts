
import { MORPH_SETS, getPixelIcon } from './pixel-icons'
import type { PixelIconDef } from './pixel-icons'

export type PixelShapeDef = PixelIconDef & {
  id: string
}

const PRODUCTIVITY_ICON_NAMES = [
  'tasks',
  'calendar',
  'time',
  'pomodoro',
  'kanban',
  'inbox',
  'goals',
  'streaks',
  'focus',
  'reminders',
  'analytics',
  'capture',
] as const

export const PRODUCTIVITY_SHAPES: PixelShapeDef[] =
  PRODUCTIVITY_ICON_NAMES.map((id) => ({
    id,
    ...getPixelIcon(id),
  }))

export const getProductivityShape = (id: string) =>
  PRODUCTIVITY_SHAPES.find((shape) => shape.id === id) ??
  PRODUCTIVITY_SHAPES[0]

export const PRODUCTIVITY_MORPH_FRAMES = MORPH_SETS.productivity
