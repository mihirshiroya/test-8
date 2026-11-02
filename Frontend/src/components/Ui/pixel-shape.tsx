'use client'

import { memo, useRef, type CSSProperties } from 'react'
import { usePixelVisibility } from '../../hooks/use-pixel-visibility'
import { parseShape } from '../../lib/pixel-engine'
import { cn } from '../../lib/utills'

export type PixelAnimation = 'assemble' | 'wave' | 'flicker' | 'trail' | 'drop'

export type PixelShapeProps = {
  rows: readonly string[]
  color: string
  cell?: number
  animation?: PixelAnimation
  hovered?: boolean
  className?: string
}

/**
 * Renders a pixel glyph. All motion is CSS-driven (transform + opacity only),
 * so animations run on the compositor thread and never block React or the main thread.
 */
export const PixelShape = memo(function PixelShape({
  rows,
  color,
  cell = 20,
  animation = 'assemble',
  hovered = false,
  className,
}: PixelShapeProps) {
  const ref = useRef<HTMLDivElement>(null)
  usePixelVisibility(ref)
  const { cells, cols, rowsCount } = parseShape(rows)

  const style = {
    gridTemplateColumns: `repeat(${cols}, ${cell}px)`,
    gridTemplateRows: `repeat(${rowsCount}, ${cell}px)`,
    '--px-cell': `${cell}px`,
    '--px-color': color,
    '--px-n': cells.length,
  } as CSSProperties

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn('px-icon', className)}
      data-anim={animation}
      data-hovered={hovered ? '' : undefined}
      style={style}
    >
      {cells.map((c) => (
        <span key={c.index} className="px-cell" style={c.style}>
          <span className="px-dot" />
        </span>
      ))}
    </div>
  )
})
