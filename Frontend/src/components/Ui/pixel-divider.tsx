export function PixelDivider({
  orientation = 'horizontal',
}: {
  orientation?: 'horizontal' | 'vertical'
}) {
  return (
    <span className="pixel-divider" data-orientation={orientation} aria-hidden="true">
      <span className="pixel-divider-spark" />
    </span>
  )
}
