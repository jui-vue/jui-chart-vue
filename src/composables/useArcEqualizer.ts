import { radian, rotate } from './mathUtil'
import type { DataRow } from '../types'

/**
 * Pure logic for `ArcEqualizerChart` (`chart.brush.arcequalizer`, 168 lines). **Source-confirmed,
 * don't assume from the name or from PORT_STATUS.md's own earlier "pie-family" grouping note**:
 * `extend: "chart.brush.core"` **directly** - it shares no `extend` chain with `chart.brush.pie`/
 * `chart.brush.donut`, nor with `equalizer.js`/`bargauge.js`/`fullgauge.js` despite the shared
 * naming pattern (all of which also `extend: "chart.brush.core"` independently - see
 * `useGauge.ts`'s/`useSeries.ts`'s own header comments for that recurring lesson). It hand-rolls
 * its own trig (a private `polarToCartesian()`/`describeArc()`), not a call into `pie.js`/
 * `donut.js`.
 *
 * **The actual visual model, confirmed from `drawBefore()`/`draw()`/`calculateData()` - genuinely
 * a hybrid, not a pure port of either its pie-family namesake-adjacent charts or of
 * `equalizer.js`**:
 * - Unlike `PieChart`/`DonutChart`/`PyramidChart` (always exactly ONE `data` row), `arcequalizer`
 *   iterates potentially MANY rows (`this.listData()` - `dataCount = listData().length`), one full
 *   angular WEDGE per row, each spanning an EQUAL `360 / dataCount` degrees (an equal angular
 *   split by ROW COUNT, unlike `PieChart`'s value-weighted slice angles) - `data` here is closer
 *   to `BarChart`'s `DataRow[]` shape than to `PieChart`'s single `DataRow`.
 * - Within each row's wedge, every `target` key stacks radially outward from `textRadius` (a fixed
 *   inner-hole radius, leaving room for the center total-value label) to the outer bounding
 *   radius `r`, in small fixed-thickness (`stackSize = (r - textRadius) / stackCount`) arc-band
 *   "blocks" - the direct radial/angular analog of `equalizer.js`'s straight-line pixel blocks
 *   (see `useSeries.ts`'s `equalizerBlocks`/`equalizerStackedBlocks`), except:
 *   - each block is a small **annular-sector** ("thick arc segment" / curved trapezoid) shape, not
 *     a straight rectangle - see `arcEqualizerBlockPath` - spanning the row's FULL wedge angle (no
 *     per-block angular subdivision - only the radius varies block-to-block within one wedge);
 *   - the per-target block COUNT is `Math.ceil(stackCount * (value / maxValue))` - a flat
 *     value-vs-configured-maximum ratio (like `fullGaugeRate`), not `equalizer.js`'s
 *     zero-baseline pixel-fill math, and NOT `equalizerbar.js`/`equalizercolumn.js`'s
 *     remaining-capacity-with-leftover-gap math either (`equalizerStackedBlocks`) - there is no
 *     leftover/partial-block case here at all, since the count is a plain `ceil`, not a
 *     fill-until-you-run-out-of-pixels loop;
 *   - blocks are stacked by TARGET (like `equalizerbar`/`equalizercolumn`'s per-segment stacking,
 *     one solid color per target via `this.color(j)`), not color-banded by block index like
 *     `equalizer.js`'s own zone-coloring;
 *   - there is no gap between adjacest blocks (radially or angularly) - visual separation comes
 *     only from each block's own stroke border (`arcEqualizerBorderColor`/`Width`), unlike
 *     `equalizer.js`'s explicit hardcoded 1.5px pixel gap.
 * - This port therefore builds genuinely NEW radial-block composable logic here (this file),
 *   rather than reusing `useSeries.ts`'s `equalizerBlocks`/`equalizerStackedBlocks` (pixel/linear,
 *   wrong shape entirely) or `usePie.ts`'s slice-angle math (`usePieSlices` computes
 *   VALUE-weighted angles; this brush's wedge angles are row-COUNT-weighted, a fundamentally
 *   different formula) - though it DOES reuse `usePie.ts`'s underlying polar-coordinate primitives
 *   (`radian`/`rotate` from `mathUtil.ts`): confirmed algebraically that the source's own
 *   `polarToCartesian(cx,cy,r,deg)` (a `(deg-90)`-phase-shifted `cos`/`sin` pair) produces the
 *   exact same point as `{x: cx + rotate(0,-r,radian(deg)).x, y: cy + rotate(0,-r,radian(deg)).y}`
 *   - i.e. the same "0deg = 12 o'clock, clockwise" convention `usePieSlices`/`pieSlicePath`/
 *   `donutSlicePath` already use, just hand-rolled independently in the original source rather
 *   than shared via an `extend` chain.
 *
 * **Center total-value text**: `this.format(total)` where `total` is the sum of every row's every
 * target's RAW value (not stack-count-scaled) - ported as a plain reduce, see `ArcEqualizerChart
 * .vue`. No default `format` is read from the original chart-level fallback (see `base/draw.js`'s
 * `this.format()`); this port follows the same "default identity" convention already established
 * for `BarChart.vue`'s own `format` prop.
 *
 * **No-data placeholder**: `calculateData()`'s `if (stackData.length == 0)` branch only fires when
 * `data` is an empty array (`listData()` never iterates) - it synthesizes a single full-circle
 * wedge (`dataCount` stays `0`, so `drawBefore()`'s `stackAngle = 360 / 1 = 360`) where target `0`
 * gets ALL `stackCount` blocks and every other target gets `0`, and - **separately** - `draw()`'s
 * own `fill: (dataCount == 0) ? backgroundColor : this.color(j)` check forces every block's fill
 * to the flat `arcEqualizerBackgroundColor` placeholder color regardless of which target "owns"
 * it, analogous to `pieNoDataBackgroundColor`. Ported as `arcEqualizerRows`' `isPlaceholder` flag.
 */

export interface ArcEqualizerLayout {
  /** Outer bounding radius (`r` in the source): `Math.min(width, height) / 2`. */
  r: number
  cx: number
  cy: number
  /** Radial thickness of one block: `(r - textRadius) / stackCount`. */
  stackSize: number
}

/**
 * Ported from `drawBefore()`: `r`/`cx`/`cy` center a circle of diameter `Math.min(width, height)`
 * within a possibly-non-square `width` x `height` area (the excess on the longer axis is split
 * evenly on both sides - `dist / 2`), exactly mirroring `chart.grid.panel`'s own cell-centering
 * convention already used by `fullGaugeRadii`'s callers. `stackSize` is `0`-safe only insofar as
 * `stackCount <= 0` isn't special-cased (matches the source - not guarded there either).
 */
export function arcEqualizerLayout(width: number, height: number, textRadius: number, stackCount: number): ArcEqualizerLayout {
  const dist = Math.abs(width - height)
  const r = Math.min(width, height) / 2
  const cx = r + (width > height ? dist / 2 : 0)
  const cy = r + (width < height ? dist / 2 : 0)
  const stackSize = (r - textRadius) / stackCount
  return { r, cx, cy, stackSize }
}

/** Ported from `drawBefore()`: `360 / (dataCount == 0 ? 1 : dataCount)` - the equal angular width of one row's wedge. */
export function arcEqualizerStackAngle(dataCount: number): number {
  return 360 / (dataCount === 0 ? 1 : dataCount)
}

/**
 * Ported from `calculateData()`'s `maxValue` resolution: a plain number is used as-is; a callback
 * is invoked once per row and the running max is kept (`self.eachData(...)`). Returns `0` (the
 * source's own unrun initial value) when `rows` is empty and `maxValue` is a callback - moot in
 * practice since {@link arcEqualizerRows} only ever computes per-target rates for real rows.
 */
export function arcEqualizerMaxValue(rows: DataRow[], maxValue: number | ((row: DataRow) => number)): number {
  if (typeof maxValue !== 'function') return maxValue
  let max = 0
  for (const row of rows) max = Math.max(max, maxValue(row))
  return max
}

/** One row's per-target block counts, plus whether this is the synthetic no-data placeholder row - see this file's header comment. */
export interface ArcEqualizerRowCounts {
  counts: number[]
  isPlaceholder: boolean
}

/**
 * Ported from `calculateData()`: per real row, `Math.ceil(stackCount * (row[key] / maxValue))` per
 * target (`row[key]` defaults to `0` for a missing/undefined field - a small, deliberate guard
 * beyond the source's literal `data[key] / maxValue`, which would compute `NaN` for a missing key;
 * matches this port's established `row[key] || 0`-style defensiveness elsewhere, e.g.
 * `usePieSlices`). An empty `rows` array returns the single synthetic placeholder row instead
 * (target `0` = `stackCount`, every other target = `0`) - see this file's header comment.
 * `maxValue` here is already the RESOLVED number (see {@link arcEqualizerMaxValue}), not a
 * possible callback.
 */
export function arcEqualizerRows(rows: DataRow[], target: string[], maxValue: number, stackCount: number): ArcEqualizerRowCounts[] {
  if (rows.length === 0) {
    return [{ counts: target.map((_, j) => (j === 0 ? stackCount : 0)), isPlaceholder: true }]
  }

  return rows.map((row) => ({
    counts: target.map((key) => Math.ceil(stackCount * ((row[key] ?? 0) / maxValue))),
    isPlaceholder: false,
  }))
}

function arcPoint(cx: number, cy: number, radius: number, angleDeg: number): { x: number; y: number } {
  const p = rotate(0, -radius, radian(angleDeg))
  return { x: cx + p.x, y: cy + p.y }
}

/**
 * One arc-band "block" `d` path, ported from `drawPath()`/`describeArc()`: a closed annular-sector
 * shape between `innerRadius` and `outerRadius`, spanning `startAngle` to `endAngle` degrees
 * (0deg = 12 o'clock, clockwise - same convention as `pieSlicePath`/`donutSlicePath`). Traces the
 * inner arc from `startAngle` to `endAngle`, a radial line out to the outer radius, the outer arc
 * back from `endAngle` to `startAngle`, then a radial line back in to close - the same
 * two-arcs-plus-two-radial-lines construction as a donut ring slice, except closed into one solid
 * filled band instead of a single stroked centerline.
 *
 * A full `360deg` span can't be drawn as a single arc command (coincident start/end points) -
 * clamped fractionally short to `359.9`, literally ported from the source (one decimal place less
 * precise than `donutSlicePath`'s own, separately-sourced `359.9999` clamp - kept as two
 * independent constants, not unified).
 */
export function arcEqualizerBlockPath(cx: number, cy: number, innerRadius: number, outerRadius: number, startAngle: number, endAngle: number): string {
  const clampedEnd = endAngle - startAngle === 360 ? 359.9 : endAngle
  const largeArc = clampedEnd - startAngle <= 180 ? 0 : 1

  const innerStart = arcPoint(cx, cy, innerRadius, startAngle)
  const innerEnd = arcPoint(cx, cy, innerRadius, clampedEnd)
  const outerStart = arcPoint(cx, cy, outerRadius, startAngle)
  const outerEnd = arcPoint(cx, cy, outerRadius, clampedEnd)

  return [
    `M ${innerStart.x} ${innerStart.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 1 ${innerEnd.x} ${innerEnd.y}`,
    `L ${outerEnd.x} ${outerEnd.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 0 ${outerStart.x} ${outerStart.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ')
}

/** One target's combined block path within a single row's wedge - see {@link arcEqualizerWedgeBlocks}. */
export interface ArcEqualizerTargetBlocks {
  targetIndex: number
  /** All of this target's blocks' subpaths concatenated into one `d` string - matches the source
   * appending multiple `drawPath()` subpaths onto ONE `<path>` per `(row, target)` pair. `''` when
   * this target has 0 blocks (no path should be rendered). */
  path: string
  blockCount: number
  /** Radial span this target's blocks occupy (`textRadius + <blocks before this target>*stackSize`
   * to `+ <... + this target's own blockCount>*stackSize`) - port-only convenience (no upstream
   * equivalent) for anchoring a hover tooltip; both equal the same boundary when `blockCount` is 0. */
  innerRadius: number
  outerRadius: number
}

/**
 * Ported from `draw()`'s inner double loop: given one row's per-target block `counts` (see
 * {@link arcEqualizerRows}), stacks every target's blocks radially, continuing from wherever the
 * PREVIOUS target's blocks left off (`start += data[i][j]`, a running offset shared across the
 * whole row - the radial/angular analog of `equalizerStackedBlocks`'s row-shared running position,
 * though notably simpler here since there's no leftover-capacity/remainder case - see this file's
 * header comment). `startAngle`/`endAngle` are this row's own wedge bounds (`i * stackAngle` to
 * `(i + 1) * stackAngle`), shared by every block in every target of this row (only the radius
 * varies block-to-block, never the angle).
 */
export function arcEqualizerWedgeBlocks(counts: number[], cx: number, cy: number, textRadius: number, stackSize: number, startAngle: number, endAngle: number): ArcEqualizerTargetBlocks[] {
  const result: ArcEqualizerTargetBlocks[] = []
  let start = 0

  counts.forEach((count, targetIndex) => {
    const subpaths: string[] = []
    const innerRadius = textRadius + start * stackSize
    for (let k = start; k < start + count; k++) {
      const inner = textRadius + k * stackSize
      const outer = inner + stackSize
      subpaths.push(arcEqualizerBlockPath(cx, cy, inner, outer, startAngle, endAngle))
    }
    start += count
    const outerRadius = textRadius + start * stackSize
    result.push({ targetIndex, path: subpaths.join(' '), blockCount: count, innerRadius, outerRadius })
  })

  return result
}
