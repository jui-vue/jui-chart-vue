import type { DataRow } from '../types'
import type { OrdinalScale } from './useScale'

/** One rendered grid cell - see `heatmapCells`. */
export interface HeatmapCell {
  /** Row index into `data` - forwarded as `dataIndex` on events (`addEvent(group, i, null)`). */
  index: number
  row: DataRow
  x: number
  y: number
  width: number
  height: number
  centerX: number
  centerY: number
  /** `format(row)` if a `format` function is given, else `row[textField]` (matching `getValue(data,
   * "text")`'s own `''` default for a missing field) - always rendered, unlike `pin.js`'s `format`
   * (which gates the label's very existence). */
  label: string | number
}

/**
 * Ported from `heatmap.js`'s `draw()` (84 lines, `extend: "chart.brush.core"` **directly** - no
 * relation to `heatmapscatter.js` despite the shared file-naming pattern; each has its own,
 * unrelated `extend` chain, see `HeatmapChart.vue`'s header comment for the full derivation).
 *
 * **One cell per DATA ROW, not per (row, target) pair** - `heatmap.js` never reads `this.brush
 * .target` anywhere in the file (confirmed by reading all 84 lines), unlike every other axis-based
 * brush this port has ported so far.
 *
 * **Positioning, source-confirmed to need a component-level field lookup, not a scale/axis change**:
 * the source computes `cx = this.axis.x(i)`, `cy = this.axis.y(i)` - both driven by the SAME row
 * index `i`, on grid.block.js's own `wrapper(scale, key)`: when the x/y axis config has a `key`
 * option set, `new_scale(i)` resolves to `old_scale(this.axis.data[i][key])` (looks up a FIELD
 * value from row `i`, then scales that value) rather than treating `i` as a literal index. This
 * port's `OrdinalScale` (`useScale.ts`) already resolves a *string* argument via `domain.indexOf
 * (value)` (confirmed unchanged, needed no edits) - so this composable just calls that existing
 * primitive directly with `row[xField]`/`row[yField]` instead of replicating grid.block.js's
 * `wrapper()` indirection layer, which has no purpose once the field lookup happens here instead of
 * inside a generic per-brush `axis.x(i)` call. **Faithfully-preserved upstream limitation**: since
 * this port's `OrdinalScale`, like the raw `util.scale.ordinal.js` it's ported from, treats a
 * *numeric* argument as a literal range INDEX (not a `domain.indexOf()` lookup - see `useScale.ts`'s
 * own doc comment), a NUMERIC `xField`/`yField` value only resolves to the correct cell when the
 * axis's `domain` array is exactly `[0, 1, ..., N-1]` in that order; a STRING field value always
 * works correctly via `domain.indexOf()` regardless of domain order. `axisX`/`axisY` must both be
 * `"block"`-type with an explicit `domain` array of the distinct category labels (not a field-name
 * string, which would derive one domain entry per DATA ROW, undeduplicated - wrong for a grid axis).
 *
 * `w`/`h` (`axis.x.rangeBand() - borderWidth` / `axis.y.rangeBand() - borderWidth`) are computed
 * once, shared by every cell (both axes' `rangeBand()` is constant across their whole domain for an
 * evenly-spaced `createOrdinalScale`).
 */
export function heatmapCells(
  data: DataRow[],
  xField: string,
  yField: string,
  textField: string,
  xScale: OrdinalScale,
  yScale: OrdinalScale,
  xBand: number,
  yBand: number,
  borderWidth: number,
  format?: (row: DataRow) => string | number,
): HeatmapCell[] {
  const w = xBand - borderWidth
  const h = yBand - borderWidth
  const cells: HeatmapCell[] = []

  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    const cx = xScale(row[xField])
    const cy = yScale(row[yField])
    if (cx == null || cy == null) continue

    const label = typeof format === 'function' ? format(row) : (row[textField] ?? '')

    cells.push({
      index: i,
      row,
      x: cx - w / 2,
      y: cy - h / 2,
      width: w,
      height: h,
      centerX: cx,
      centerY: cy,
      label,
    })
  }

  return cells
}
