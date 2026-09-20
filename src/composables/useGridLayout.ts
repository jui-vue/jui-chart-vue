/**
 * Small-multiples grid layout, ported from `juijs-graph`'s `chart.grid.table` (the grid type
 * `axis.c` is set to for pie/donut's small-multiples mode) - specifically its `drawBefore()`/
 * `scale(i)` cell-rect math (row-major: `r = floor(i / columns)`, `c = i % columns`, each cell
 * an equal fraction of the available width/height minus `(count - 1) * gap` spread evenly
 * between cells). Pure geometry only, no DOM/axis coupling - see `PieGrid.vue`/`DonutGrid.vue`
 * for how it's consumed (nested-`<svg>` positioning rather than the original's shared-brush
 * `axis.c(index)` lookup - see PORT_STATUS.md for why).
 */

export interface GridCell {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Resolves the row count for a grid of `count` cells laid out in `columns` columns: an explicit
 * `rows` (if positive) wins, otherwise it's `ceil(count / columns)` - the original's `table.js`
 * always requires both `rows` and `columns` explicitly; this auto-derivation is a Vue-port
 * ergonomic addition (so `<PieGrid>` only needs `columns` for the common case), not a port of
 * original behavior.
 */
export function resolveGridRows(count: number, columns: number, rows?: number): number {
  if (rows && rows > 0) return rows
  return Math.max(1, Math.ceil(count / Math.max(1, columns)))
}

/**
 * Cell rect for `index` in a `rows` x `columns` grid packed row-major into `width` x `height`,
 * with `gap` px between cells (both directions) - ported from `chart.grid.table`'s `scale(i)`.
 * `x`/`y` are relative to the grid's own origin (the original adds `axis.area('x'/'y')`, which
 * this port's callers fold in themselves via nested-`<svg>` positioning instead).
 */
export function gridCellRect(index: number, rows: number, columns: number, width: number, height: number, gap: number): GridCell {
  const columnUnit = (width - (columns - 1) * gap) / columns
  const rowUnit = (height - (rows - 1) * gap) / rows

  const r = Math.floor(index / columns)
  const c = index % columns

  return {
    x: c * columnUnit + gap * c,
    y: r * rowUnit + gap * r,
    width: columnUnit,
    height: rowUnit,
  }
}

/** Cell rects for all `count` cells of a grid, in index order. See `gridCellRect`/`resolveGridRows`. */
export function gridCells(count: number, columns: number, width: number, height: number, gap: number, rows?: number): GridCell[] {
  const resolvedRows = resolveGridRows(count, columns, rows)
  return Array.from({ length: count }, (_, i) => gridCellRect(i, resolvedRows, columns, width, height, gap))
}
