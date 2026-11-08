export function docsHeadingAnchors(contentId: string, depths: number[]) {
  const mainDepth = depths.includes(2) ? 2 : 1
  let mainIndex = 0
  return depths.map((depth, index) => ({
    id: depth === mainDepth ? `content-${contentId}-heading-${mainIndex++}` : `content-${contentId}-detail-${index}`,
    main: depth === mainDepth,
  }))
}
