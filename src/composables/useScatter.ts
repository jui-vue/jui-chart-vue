import type { ScatterSymbol } from '../types'

/** Resolves `ScatterChart`'s `symbol` prop, ported from `getSymbolType()`'s shape branch (the image-URI branch is out of scope - see `ScatterChart.vue`'s header comment). */
export function resolveScatterSymbol(symbol: ScatterSymbol | ((key: string, value: number) => ScatterSymbol), key: string, value: number): ScatterSymbol {
  return typeof symbol === 'function' ? symbol(key, value) : symbol
}

/** Identifies one marker for hover/`activeEvent` highlight-matching purposes. */
export interface ScatterPointRef {
  /** Row index - the identity `hoverSync` groups markers by. */
  index: number
  key: string
}

/**
 * Ported from `createScatter()`'s `hoverSync` cached-symbol loop: without `hoverSync`, only the
 * exact hovered/active marker (same row index AND same target key) highlights; with it, every
 * target's marker at that same row index highlights together, matching the original's
 * `self.cachedSymbol[dataIndex]` loop over every target's cached element for that row.
 */
export function isScatterHighlighted(point: ScatterPointRef, highlighted: ScatterPointRef | null, hoverSync: boolean): boolean {
  if (!highlighted) return false
  return highlighted.index === point.index && (hoverSync || highlighted.key === point.key)
}

/**
 * Ported from `createScatter()`'s triangle branch: an isoceles triangle inscribed in the
 * `size`x`size` box centered on `(x, y)` - apex up, base at the bottom, matching
 * `poly.point(0,h).point(w,h).point(w/2,0)` translated to `(x - w/2, y - h/2)`. Returned as an
 * SVG `<polygon points="...">` value.
 */
export function scatterTrianglePoints(x: number, y: number, size: number): string {
  const half = size / 2
  return `${x - half},${y + half} ${x + half},${y + half} ${x},${y - half}`
}
