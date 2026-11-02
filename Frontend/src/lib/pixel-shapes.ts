import { MORPH_SETS, PIXEL_ICONS, PIXEL_PALETTE, type PixelIconDef, type PixelIconName } from './pixel-icons'

export { parseShape, seeded, type Cell } from './pixel-engine'

export type PixelShapeDef = {
  id: string
  label: [string, string]
  color: string
  rows: string[]
}

export const PALETTE = PIXEL_PALETTE

export function toShapeDef(id: PixelIconName): PixelShapeDef {
  const icon: PixelIconDef = PIXEL_ICONS[id]
  return { id, label: icon.label ?? [id, ''], color: icon.color, rows: icon.rows }
}

export const SHAPES: PixelShapeDef[] = (
  ['capabilities', 'lgtm', 'observability', 'testing', 'pipelines', 'security', 'deploy', 'scale'] as const
).map(toShapeDef)

export const MORPH_FRAMES = MORPH_SETS.shapes
