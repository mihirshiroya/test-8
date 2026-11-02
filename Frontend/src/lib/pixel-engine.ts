import type { CSSProperties } from 'react'

export type Cell = { x: number; y: number; index: number; style: CSSProperties }

export type ParsedShape = { cells: Cell[]; cols: number; rowsCount: number }

export function seeded(n: number) {
  const s = Math.sin(n * 9301 + 49297) * 233280
  return s - Math.floor(s)
}

const round = (n: number) => Math.round(n * 1000) / 1000

// Parsing + per-pixel random offsets are computed once per unique glyph and shared by every instance.
const cache = new Map<string, ParsedShape>()

export function parseShape(rows: readonly string[]): ParsedShape {
  const key = rows.join('|')
  const hit = cache.get(key)
  if (hit) return hit

  const cells: Cell[] = []
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== '#') continue
      const i = cells.length
      cells.push({
        x,
        y,
        index: i,
        style: {
          gridColumnStart: x + 1,
          gridRowStart: y + 1,
          ['--i' as string]: i,
          ['--x' as string]: x,
          ['--r1' as string]: round(seeded(i) - 0.5),
          ['--r2' as string]: round(seeded(i + 7) - 0.5),
          ['--r3' as string]: round(seeded(i + 3) - 0.5),
          ['--h1' as string]: round(seeded(i + 11) - 0.5),
          ['--h2' as string]: round(seeded(i + 23) - 0.5),
          ['--fr' as string]: round(seeded(i)),
        },
      })
    }
  })

  const parsed = { cells, cols: Math.max(...rows.map((r) => r.length)), rowsCount: rows.length }
  cache.set(key, parsed)
  return parsed
}
