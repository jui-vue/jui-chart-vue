/**
 * Pure bucketing math for `HeatmapScatterChart.vue`, ported from `heatmapscatter.js` (152 lines,
 * `extend: "chart.brush.core"` **directly** - source-confirmed NOT related to `heatmap.js` despite
 * the shared file-naming pattern (this port's now-recurring "looks related, isn't" finding - each
 * has its own independent `extend` chain and its own, unrelated color/geometry model). See
 * `HeatmapScatterChart.vue`'s header comment for the full derivation of what a "heatmap scatter" is
 * (a coarse 2D density grid over ordinary scatter points, NOT a scatter chart with heatmap-style
 * per-point coloring).
 *
 * **Source-confirmed x-axis substitution, matching `selectbox.js`'s already-established precedent**:
 * the real example (`examples/heatmapscatter.html`) uses a `type: "date"` x-axis - this port has no
 * date/time axis type (confirmed gap, first found porting `selectbox.js`). Re-reading `drawScatter()`
 * closely: point x-position is `this.axis.x(i)` (row INDEX, not a field value) - the same
 * "numeric-argument-as-index" convention this port's `OrdinalScale`/`useSeries`'s "block" branch
 * already implements for every other component - while `drawBefore()`'s grid-boundary math
 * (`axis.x.max() - axis.x.min()`, `xDist = xValue/xInterval`) treats the SAME axis as a genuine
 * *value* domain. Upstream reconciles this because a date-type axis's own `wrapper()` (analogous to
 * `grid/block.js`'s) supports both an index-shortcut for `axis.x(i)` AND real date-value lookups for
 * `axis.x(realDate)` on the SAME scale object - a dual nature this port's plain block `OrdinalScale`
 * only half-supports (its own "numeric arg = index" quirk collides with genuine value lookups for
 * anything but a domain that happens to start at 0). Rather than force that ambiguity through, this
 * port makes a clean, explicit adaptation: the x-axis stays `"block"`-type (so `axis.x(i)` correctly
 * positions each row via this port's already-correct index convention), and the BUCKETING dimension
 * runs over the axis's own TICK-INDEX space (`[0, tickCount)`) rather than over literal axis values -
 * `xInterval` means "how many consecutive x-axis category ticks share one bucket column" (an
 * integer, e.g. `5` groups 5 consecutive time-label ticks into one column), not "domain units per
 * bucket" like the source's date-axis `xInterval` (milliseconds). The y-axis is unaffected - it's
 * always `"range"` (a real numeric value axis in both the source and this port), so `yInterval`
 * keeps its literal source meaning (value units per bucket row) with no adaptation needed.
 *
 * **`xInterval`/`yInterval` are required props with no default**, deliberately deviating from the
 * source's own `.setup()` default of `0` for both - a `0` default makes `xDist`/`yDist` divide-by-
 * zero (`Infinity`/`NaN`), an unusable starting state the source's own real example always overrides
 * explicitly (`xInterval: 5000, yInterval: 250`) - this port surfaces that as a compile-time-required
 * prop instead of silently shipping a broken default.
 */

export interface HeatmapScatterGridDims {
  /** Number of bucket columns (`tickCount / xInterval`). */
  xDist: number
  /** Number of bucket rows (`(yMax - yMin) / yInterval`). */
  yDist: number
  /** Bucket column pixel width (`areaWidth / xDist`). */
  xSize: number
  /** Bucket row pixel height (`areaHeight / yDist`). */
  ySize: number
}

/**
 * Ported from `drawBefore()`: `xValue = axis.x.max()-axis.x.min()` / `xDist = xValue/xInterval` /
 * `xSize = axis.area("width")/xDist` (and the y-axis equivalents) - see this file's header comment
 * for why `tickCount` (the x-axis's tick-index span) substitutes for the source's literal
 * `axis.x.max()-axis.x.min()` domain-value span. A non-positive `xInterval`/`yInterval` yields `0`
 * for the corresponding `xDist`/`yDist`/`xSize`/`ySize` (defensive - the source's own unguarded
 * division would produce `Infinity`, matching why this port makes both intervals required props).
 */
export function heatmapScatterGrid(
  tickCount: number,
  yMin: number,
  yMax: number,
  xInterval: number,
  yInterval: number,
  areaWidth: number,
  areaHeight: number,
): HeatmapScatterGridDims {
  const xDist = xInterval > 0 ? tickCount / xInterval : 0
  const yValue = yMax - yMin
  const yDist = yInterval > 0 ? yValue / yInterval : 0
  const xSize = xDist > 0 ? areaWidth / xDist : 0
  const ySize = yDist > 0 ? areaHeight / yDist : 0
  return { xDist, yDist, xSize, ySize }
}

export interface HeatmapScatterBucketIndex {
  rowIndex: number
  columnIndex: number
}

/**
 * Ported from `getTableData()`: rounds a point's position to the nearest bucket, clamping to the
 * last valid row/column instead of overflowing past the grid (`if (xIndex >= xDist) xIndex = xDist
 * - 1`, ported literally, including the `< 0` clamp for symmetry with the source). Source rounds
 * via `.toFixed(0)` (string) then a loose `>=` comparison against the numeric `xDist`/`yDist` -
 * `Math.round` is numerically equivalent for every case this port's callers produce (no negative-
 * zero or exotic-precision inputs), so it's used directly here instead of the string round-trip.
 *
 * `rowOrderIndex` is the point's own row-index position within its axis's tick order (this port's
 * substitute for the source's `axis.x.invert(pos.x)` round-trip - see this file's header comment;
 * since this port already has the point's row index directly, no pixel->domain round-trip is
 * needed, an equivalent simplification, not a behavior change). `value` is the point's raw (already
 * un-scaled) y-axis value - likewise substituting for the source's `axis.y.invert(pos.y)` round-trip,
 * for the same reason.
 */
export function heatmapScatterBucketIndex(
  rowOrderIndex: number,
  value: number,
  xInterval: number,
  yMin: number,
  yInterval: number,
  xDist: number,
  yDist: number,
): HeatmapScatterBucketIndex {
  let columnIndex = xInterval > 0 ? Math.round(rowOrderIndex / xInterval) : 0
  let rowIndex = yInterval > 0 ? Math.round((value - yMin) / yInterval) : 0

  if (columnIndex >= xDist) columnIndex = xDist - 1
  if (rowIndex >= yDist) rowIndex = yDist - 1
  if (columnIndex < 0) columnIndex = 0
  if (rowIndex < 0) rowIndex = 0

  return { rowIndex, columnIndex }
}
