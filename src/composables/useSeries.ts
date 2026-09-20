import { computed, type ComputedRef, type Ref } from 'vue'
import type { AxisResult } from './useAxis'
import type { BarDisplayMode, DataRow, RangeSeriesPoint, SeriesPoint } from '../types'

export type AxisKind = 'block' | 'range'

/**
 * A minimal scale surface `useSeries` needs: called with a row's positional index for a
 * "block" axis, or with the row's raw field value for a "range" axis.
 */
export type SeriesScale = (value: number) => number

/** Adapts a `useAxis()` result's scale (which may return `null` for an unknown ordinal key) into the non-nullable `SeriesScale` shape `useSeries` expects. */
export function toSeriesScale(axis: AxisResult): SeriesScale {
  return (value: number) => {
    const result = axis.scale(value)
    return typeof result === 'number' ? result : NaN
  }
}

/**
 * Ported from `chart.brush.core`'s `getXY()`: converts data rows into per-target pixel
 * coordinate arrays. Whichever axis is "block" is evaluated once per row (by index, same
 * position for every target that row); whichever axis is "range" is evaluated per target (by
 * that target's field value) - this generalizes the original, which hard-coded exactly one of
 * x/y as the "range" side, to also work when a caller passes block for both (or neither).
 */
export function useSeries(
  data: Ref<DataRow[]>,
  target: Ref<string[]>,
  xScale: Ref<SeriesScale>,
  yScale: Ref<SeriesScale>,
  xType: Ref<AxisKind>,
  yType: Ref<AxisKind>,
): ComputedRef<SeriesPoint[]> {
  return computed(() => {
    const rows = data.value
    const targets = target.value
    const length = rows.length

    // getMinMaxValue: min/max per target field, across all rows.
    const minMax: Record<string, { min: number; max: number }> = {}
    for (const key of targets) {
      let min = Infinity
      let max = -Infinity
      for (const row of rows) {
        const v = row[key]
        if (typeof v !== 'number') continue
        if (v < min) min = v
        if (v > max) max = v
      }
      minMax[key] = { min, max }
    }

    const result: SeriesPoint[] = targets.map(() => ({
      x: new Array(length),
      y: new Array(length),
      value: new Array(length),
      min: new Array(length),
      max: new Array(length),
    }))

    const xFn = xScale.value
    const yFn = yScale.value
    const isXBlock = xType.value === 'block'
    const isYBlock = yType.value === 'block'

    for (let i = 0; i < length; i++) {
      const row = rows[i]
      const blockX = isXBlock ? xFn(i) : 0
      const blockY = isYBlock ? yFn(i) : 0

      for (let j = 0; j < targets.length; j++) {
        const key = targets[j]
        const value = row[key]

        const x = isXBlock ? blockX : xFn(value)
        const y = isYBlock ? blockY : yFn(value)

        result[j].x[i] = x
        result[j].y[i] = y
        result[j].value[i] = value
        result[j].min[i] = value === minMax[key]?.min
        result[j].max[i] = value === minMax[key]?.max
      }
    }

    return result
  })
}

/**
 * Ported from `chart.brush.core`'s `getStackXY()`: like `useSeries`, but the coordinate on
 * whichever axis is `"range"` (value-scaled) encodes each target's *cumulative* value - the
 * running sum of every earlier target in `target` plus its own value - so consecutive targets
 * stack on top of one another (target order = stacking order, first target at the base).
 * `value`/`min`/`max` and the `"block"` axis coordinate are unchanged from `useSeries` (still
 * each target's own raw value, not the cumulative sum) - only the range-axis x/y placement is
 * affected, matching the original: `stackarea.js`/`stackline.js`/`stackscatter.js` are thin
 * wrappers that swap `getXY()` for `getStackXY()` and hand the result to the same
 * `drawArea`/`drawLine`/`drawScatter` renderer `useSeries`-based (non-stacked) brushes use.
 *
 * Exactly one of `xType`/`yType` is expected to be `"range"` (the stacking axis) and the other
 * `"block"` (evaluated once per row) - the same assumption the original engine makes
 * throughout. If `yType` is `"range"`, y is stacked; otherwise x is (matching
 * `getStackXY`'s `isRangeY ? ... : ...` branch, generalized the same way `useSeries` already
 * generalizes `getXY`).
 */
export function useStackedSeries(
  data: Ref<DataRow[]>,
  target: Ref<string[]>,
  xScale: Ref<SeriesScale>,
  yScale: Ref<SeriesScale>,
  xType: Ref<AxisKind>,
  yType: Ref<AxisKind>,
): ComputedRef<SeriesPoint[]> {
  const base = useSeries(data, target, xScale, yScale, xType, yType)

  return computed(() => {
    const result: SeriesPoint[] = base.value.map((point) => ({
      x: point.x.slice(),
      y: point.y.slice(),
      value: point.value.slice(),
      min: point.min.slice(),
      max: point.max.slice(),
    }))

    const rows = data.value
    const targets = target.value
    const stackY = yType.value === 'range'
    const scale = stackY ? yScale.value : xScale.value

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      let valueSum = 0

      for (let j = 0; j < targets.length; j++) {
        const value = row[targets[j]]

        if (j > 0) {
          const prevValue = row[targets[j - 1]]
          valueSum += typeof prevValue === 'number' ? prevValue : 0
        }

        const stacked = (typeof value === 'number' ? value : 0) + valueSum
        const coord = scale(stacked)

        if (stackY) {
          result[j].y[i] = coord
        } else {
          result[j].x[i] = coord
        }
      }
    }

    return result
  })
}

/**
 * Ported from `chart.brush.core`'s `getXY()` as read by `rangearea.js`/`rangebar.js`/
 * `rangecolumn.js`: each `data[i][target[j]]` is expected to be a 2-element `[low, high]` tuple
 * (confirmed from source: `value[0]`/`value[1]`, NOT two separate `target` field names) - this is
 * `useSeries`'s single-value-per-point model doubled, not a variant of it, so it lives as its own
 * function rather than a `useSeries` wrapper (unlike `useStackedSeries`, which reuses `useSeries`'s
 * own x/y/value output as its base). Same block/range-axis generalization as `useSeries`: whichever
 * axis is `"block"` is evaluated once per row (shared by the low and high coordinate - only the
 * `"range"` axis coordinate differs between them), whichever is `"range"` is evaluated once for
 * `low` and once for `high`. A row whose value isn't a 2-element array yields `NaN`/`undefined`
 * coordinates for that row (skipped by consumers - `rangearea.js`/`rangebar.js`/`rangecolumn.js`
 * don't guard against malformed data either, so this matches the source's own lack of a guard).
 */
export function useRangeSeries(
  data: Ref<DataRow[]>,
  target: Ref<string[]>,
  xScale: Ref<SeriesScale>,
  yScale: Ref<SeriesScale>,
  xType: Ref<AxisKind>,
  yType: Ref<AxisKind>,
): ComputedRef<RangeSeriesPoint[]> {
  return computed(() => {
    const rows = data.value
    const targets = target.value
    const length = rows.length

    const result: RangeSeriesPoint[] = targets.map(() => ({
      xLow: new Array(length),
      yLow: new Array(length),
      xHigh: new Array(length),
      yHigh: new Array(length),
      low: new Array(length),
      high: new Array(length),
    }))

    const xFn = xScale.value
    const yFn = yScale.value
    const isXBlock = xType.value === 'block'
    const isYBlock = yType.value === 'block'

    for (let i = 0; i < length; i++) {
      const row = rows[i]
      const blockX = isXBlock ? xFn(i) : 0
      const blockY = isYBlock ? yFn(i) : 0

      for (let j = 0; j < targets.length; j++) {
        const raw = row[targets[j]]
        const low = Array.isArray(raw) ? raw[0] : undefined
        const high = Array.isArray(raw) ? raw[1] : undefined

        result[j].xLow[i] = isXBlock ? blockX : xFn(low as number)
        result[j].yLow[i] = isYBlock ? blockY : yFn(low as number)
        result[j].xHigh[i] = isXBlock ? blockX : xFn(high as number)
        result[j].yHigh[i] = isYBlock ? blockY : yFn(high as number)
        result[j].low[i] = low
        result[j].high[i] = high
      }
    }

    return result
  })
}

/**
 * Ported from `rangearea.js`'s `draw()`: builds one closed polygon's point-string per target,
 * tracing every row's `low` value forward (`j = 0..n-1`) then every row's `high` value backward
 * (`j = n-1..0`) - exactly the source's two `for` loops over the same `p.point(...)` polygon
 * builder. Rows whose `low`/`high` aren't both numbers are skipped (see `useRangeSeries`'s doc
 * comment on malformed data) rather than emitting `NaN` into the point string.
 */
export function rangeAreaPolygonPoints(point: RangeSeriesPoint): string {
  const n = point.low.length
  const forward: string[] = []
  const backward: string[] = []

  for (let i = 0; i < n; i++) {
    if (typeof point.low[i] !== 'number') continue
    forward.push(`${point.xLow[i]},${point.yLow[i]}`)
  }
  for (let i = n - 1; i >= 0; i--) {
    if (typeof point.high[i] !== 'number') continue
    backward.push(`${point.xHigh[i]},${point.yHigh[i]}`)
  }

  return [...forward, ...backward].join(' ')
}

/**
 * Ported from `rangebar.js`/`rangecolumn.js`'s `drawBefore()` (identical formula in both, just
 * mirrored between height/width): given the full category band size and how many targets share
 * it, returns the padded group size (`bandSize - outerPadding*2`) and each target's own item
 * thickness within that group (`(groupSize - (count-1)*innerPadding) / count`, floored at 0 - the
 * original doesn't floor, but a negative thickness from an overly-large padding config would
 * otherwise render as an inverted/negative-size rect, so this is a defensive port-only addition,
 * matching `BarChart.vue`'s own `Math.max(..., 0)` precedent for the equivalent bar.js formula).
 */
export function rangeGroupGeometry(bandSize: number, count: number, outerPadding: number, innerPadding: number): { itemSize: number; groupSize: number } {
  const groupSize = bandSize - outerPadding * 2
  const itemSize = Math.max((groupSize - (count - 1) * innerPadding) / count, 0)
  return { itemSize, groupSize }
}

/** Pixel geometry for one candlestick body - see `candleBodyGeometry`. */
export interface CandleBody {
  /** `true` when `close >= open` (the source's own "else", non-invert branch - a tie is bullish). */
  bullish: boolean
  /** Body rect's value-axis pixel start (the *higher* pixel position between open/close). */
  y: number
  /** Body rect's value-axis pixel extent. */
  height: number
}

/**
 * Ported from `candlestick.js`'s `draw()` body branch: `if (open > close)` (bearish/"invert",
 * literally the source's own condition - NOT `close < open`, so an exact tie takes the *bullish*
 * branch) anchors the body rect at `axis.y(open)` with height `abs(axis.y(close) - axis.y(open))`;
 * otherwise (`close >= open`, bullish) anchors at `axis.y(close)` with height
 * `abs(axis.y(open) - axis.y(close))`. Pure value-axis-only math (the block-axis x-center and
 * `barWidth`/`barPadding` are computed directly in `CandlestickChart.vue`, matching
 * `RangeBarChart.vue`'s own precedent of not extracting simple per-row axis-center math into a
 * composable) - takes a resolved `SeriesScale` (already the value/range axis's `axis.y`) rather
 * than raw axis config, so it's trivially unit-testable with a hand-built scale function.
 */
export function candleBodyGeometry(open: number, close: number, yScale: SeriesScale): CandleBody {
  const bullish = !(open > close)
  const anchorY = yScale(bullish ? close : open)
  const otherY = yScale(bullish ? open : close)
  return { bullish, y: anchorY, height: Math.abs(otherY - anchorY) }
}

/**
 * Ported from `chart.brush.bar`'s `drawETC()` min/max-label gate:
 * `(display == "max" && r.max) || (display == "min" && r.min) || display == "all"` - generalized
 * to an arbitrary numeric array (one value per row) rather than a `(rows, targetKey)` pair, so it
 * serves both `selectDisplayBars` (bar/column's per-*target* min/max, `r.max`/`r.min` from
 * `getMinMaxValue()` + `getXY()`) and `BarChart`'s `stacked` mode, which ported from
 * `stackbar.js`'s own `display` gate (`setActiveTooltips`) - that one selects against each row's
 * *stack total* (`sumValue`, the running sum across every `target` for that row), not any single
 * target's own value, so it can't reuse `selectDisplayBars`'s per-target-field shape directly.
 * Ties included (more than one index can qualify for `"max"`/`"min"`), matching the original.
 */
export function selectDisplayIndices(values: (number | undefined)[], mode: BarDisplayMode | null | undefined): boolean[] {
  if (mode === 'all') return values.map(() => true)
  if (mode !== 'max' && mode !== 'min') return values.map(() => false)

  let min = Infinity
  let max = -Infinity
  for (const v of values) {
    if (typeof v !== 'number') continue
    if (v < min) min = v
    if (v > max) max = v
  }
  const boundary = mode === 'max' ? max : min

  return values.map((v) => v === boundary)
}

/**
 * `selectDisplayIndices`, specialized to a `(rows, targetKey)` pair - see that function's own doc
 * comment for the shared min/max-selection logic. `BarChart` maps the returned per-row flags onto
 * its own computed bar geometry to decide which bars get a persistent value label.
 */
export function selectDisplayBars(rows: DataRow[], targetKey: string, mode: BarDisplayMode | null | undefined): boolean[] {
  return selectDisplayIndices(
    rows.map((row) => row[targetKey]),
    mode,
  )
}

/**
 * Ported from `chart.brush.core`'s `curvePoints()`: solves a tridiagonal linear system (the Thomas
 * algorithm) for the two Bezier control points `p1`/`p2` between each pair of consecutive
 * coordinates `K`, producing a smooth curve through them. Used for `LineChart`'s/`AreaChart`'s
 * `symbol="curve"`.
 *
 * **Phase F audit (re-verified): stays a hand-port, NOT vendored.** Earlier Phase F notes
 * mistakenly claimed this was "the same algorithm" as `util.canvas.base`'s `getCurvePoints`
 * (a confirmed `cardinal-spline-js`/Catmull-Rom match) - it is not. This function is a Bezier
 * control-point solve via the Thomas algorithm, traceable to Lubos Brieda's "Smooth Bézier Spline
 * Through Prescribed Points" (particleincell.com, 2012; jui-chart's own source comments cite
 * Wikipedia for the Thomas algorithm), a published technique independently reimplemented under
 * different names by several unrelated small npm packages - not a copy of one specific existing
 * library. See PORT_STATUS.md's Phase F section for the full re-verification writeup.
 */
export function curvePoints(K: number[]): { p1: number[]; p2: number[] } {
  const p1: number[] = []
  const p2: number[] = []
  const n = K.length - 1

  const a: number[] = []
  const b: number[] = []
  const c: number[] = []
  const r: number[] = []

  a[0] = 0
  b[0] = 2
  c[0] = 1
  r[0] = K[0] + 2 * K[1]

  for (let i = 1; i < n - 1; i++) {
    a[i] = 1
    b[i] = 4
    c[i] = 1
    r[i] = 4 * K[i] + 2 * K[i + 1]
  }

  a[n - 1] = 2
  b[n - 1] = 7
  c[n - 1] = 0
  r[n - 1] = 8 * K[n - 1] + K[n]

  for (let i = 1; i < n; i++) {
    const m = a[i] / b[i - 1]
    b[i] = b[i] - m * c[i - 1]
    r[i] = r[i] - m * r[i - 1]
  }

  p1[n - 1] = r[n - 1] / b[n - 1]
  for (let i = n - 2; i >= 0; --i) {
    p1[i] = (r[i] - c[i] * p1[i + 1]) / b[i]
  }

  for (let i = 0; i < n - 1; i++) {
    p2[i] = 2 * K[i + 1] - p1[i + 1]
  }
  p2[n - 1] = 0.5 * (K[n] + p1[n - 1])

  return { p1, p2 }
}

/**
 * Ported from `chart.brush.fullstackbar`/`chart.brush.fullstackcolumn`'s `draw()` - **not** a call
 * through `axis.x.rate`/`axis.y.rate`'s domain-based scale math, even though the source literally
 * calls `axis.x.rate(value, sum)`: that function is `func(func.max() * (value / max))`
 * (`util.scale.linear.js`), and since `func` is linear from a domain starting at 0, `func.max()`
 * (the domain max) always cancels out algebraically, leaving a plain `(value / sum) *
 * totalPixelSpan` - confirmed by deriving it by hand against both source files (see
 * `FullStackBarChart`'s own doc comment for the full derivation). So the geometry genuinely does
 * not depend on the value axis's configured domain at all (only its own row's `sum`) - this
 * function captures exactly that domain-independent fraction math, pure and unit-testable with no
 * axis/scale involved. Each row's segments always span the full `[0, 1]` fraction range regardless
 * of the row's raw total, in target order (index 0 = base, matching `stackedBars`'s existing
 * cumulative-stacking order).
 */
export function normalizeStackFractions(values: number[]): { sum: number; start: number[]; end: number[] } {
  const clean = values.map((v) => (typeof v === 'number' && !Number.isNaN(v) ? v : 0))
  const sum = clean.reduce((s, v) => s + v, 0)

  const start: number[] = []
  const end: number[] = []
  let cumulative = 0

  for (const v of clean) {
    const fraction = sum !== 0 ? v / sum : 0
    start.push(cumulative)
    cumulative += fraction
    end.push(cumulative)
  }

  return { sum, start, end }
}

/**
 * Ported from `fullstackbar.js`'s percent-label math: `Math.round((value / sum) * axis.x.max())`
 * (`fullstackcolumn.js` reuses the same `drawText`, against `axis.y.max()`) - unlike the segment
 * geometry above, this *does* depend on the value axis's configured domain max (it's only a true
 * 0-100 percentage when that domain's max is configured as `100`, matching both original demos'
 * `domain: [0, 100]`) - kept as its own pure function since it's a genuinely different formula from
 * `normalizeStackFractions`, not a derived view of it. Returns `NaN` when `sum` is `0` (matching
 * the source's own unguarded division), left for the caller to gate exactly like `drawText` does
 * (`percent === 0 || isNaN(percent)` hides the label).
 */
export function computeStackPercent(value: number, sum: number, axisMax: number): number {
  return Math.round((value / sum) * axisMax)
}

/** One rendered block inside `equalizer.js`'s per-(row,target) stack of small blocks - see `equalizerBlocks`. */
export interface EqualizerBlock {
  /** Pixel y of this block's top edge (smaller than `y + height`, i.e. already "top"-normalized - the source's own rect always uses `y: eY - unitHeight` on the upward branch and `y: eY` on the downward one, both already the top edge). */
  y: number
  height: number
  /** `Math.floor(eIndex / gap)` - which color band this block belongs to (0 = closest to zero). */
  colorIndex: number
}

/** Defensive iteration cap (port-only, not in the source) matching the `guard++ < 100000` pattern
 * already used in `useAxis.ts`'s `computeRangeDomain` - protects against a pathological `unit <= 0`
 * config hanging the loop instead of throwing a useful error. */
const EQUALIZER_MAX_BLOCKS = 100000

/** The fixed 1.5px gap between consecutive blocks, ported literally from `equalizer.js`'s `draw()`
 * (`var padding = 1.5`) - a hardcoded magic number in the source, not a configurable `brush` option
 * (unlike `equalizerbar.js`/`equalizercolumn.js`'s block gap, which *is* the configurable
 * `innerPadding` - a different formula for a different brush, see `equalizerSegmentBlocks`). */
export const EQUALIZER_BLOCK_GAP = 1.5

/**
 * Ported from `equalizer.js`'s `draw()` inner loop: fills the pixel span between the zero baseline
 * (`zeroY`) and a single (row, target) pair's value position (`valueY`) with fixed-height
 * (`unit`px) blocks separated by a constant `EQUALIZER_BLOCK_GAP`px gap, growing away from zero -
 * the classic VU-meter/equalizer look. The block nearest the value edge is clipped short instead of
 * overshooting past `valueY` (`(eY - unit < valueY) ? abs(eY - valueY) : unit`, ported literally),
 * so the stack always lands exactly on the value's pixel position with no partial gap at the end -
 * unlike `equalizerSegmentBlocks` below (`equalizerbar.js`/`equalizercolumn.js`), which leaves any
 * remainder shorter than one full step unfilled. `valueY === zeroY` (a zero value) yields zero
 * blocks in either branch, matching the source (no explicit zero-guard needed - the while
 * condition is simply never true). Each block's `colorIndex` cycles every `gap` blocks
 * (`Math.floor(eIndex / gap)`, `eIndex` counting from 0 at the block nearest zero) - `chart.color()`
 * consumers (this port's `color(index)`) then cycle through the theme's color list by that index,
 * producing color-banded zones (e.g. green near zero, red near the top) rather than one color per
 * target.
 */
export function equalizerBlocks(zeroY: number, valueY: number, unit: number, gap: number): EqualizerBlock[] {
  const blocks: EqualizerBlock[] = []
  if (unit <= 0) return blocks

  let eY = zeroY
  let eIndex = 0

  if (valueY <= zeroY) {
    while (eY > valueY && eIndex < EQUALIZER_MAX_BLOCKS) {
      const unitHeight = eY - unit < valueY ? Math.abs(eY - valueY) : unit
      blocks.push({ y: eY - unitHeight, height: unitHeight, colorIndex: Math.floor(eIndex / gap) })
      eY -= unitHeight + EQUALIZER_BLOCK_GAP
      eIndex++
    }
  } else {
    while (eY < valueY && eIndex < EQUALIZER_MAX_BLOCKS) {
      const unitHeight = eY + unit > valueY ? Math.abs(eY - valueY) : unit
      blocks.push({ y: eY, height: unitHeight, colorIndex: Math.floor(eIndex / gap) })
      eY += unitHeight + EQUALIZER_BLOCK_GAP
      eIndex++
    }
  }

  return blocks
}

/** One rendered block inside an `equalizerbar.js`/`equalizercolumn.js` stacked row - see
 * `equalizerStackedBlocks`. */
export interface EqualizerStackedBlock {
  /** Pixel offset from the ROW's shared zero-axis position (`axis.<x|y>(0)`) - **not** this
   * block's owning segment's own start edge - to this block's start edge; always non-negative and
   * increasing, in the *un-reversed* direction. See `equalizerStackedBlocks`'s doc comment for why
   * it's row-relative, not segment-relative. The caller (the component) is responsible for
   * flipping the sign and/or translating the whole group for `axis.<x|y>.reverse`, matching the
   * source's own `barGroup.translate((is_reverse) ? -unit : 0, 0)` (bar) /
   * `translate(0, (is_reverse) ? 0 : -unit)` (column) - a whole-group post-hoc shift, not a
   * per-block one. */
  offset: number
  /** Block size along the row's stacking axis (`unitSize`, constant for every block in every
   * segment of a given chart - see `equalizerUnitSize`). */
  size: number
}

/**
 * Ported from `equalizerbar.js`/`equalizercolumn.js`'s shared `draw()` shape - **source-confirmed
 * subtlety, easy to get wrong by assuming each segment restarts its own block train**: the running
 * pixel position (`x`/`y` in the source) is a single variable shared across the WHOLE row, declared
 * once before the per-target loop and never reset between targets - only the *remaining capacity*
 * (`targetX`/`targetY`, `= abs(startX-endX)` for that target alone) resets per target. So block
 * placement is really one continuous sequential "train" of blocks starting at the row's zero-axis
 * position, split into consecutive runs of `floor(segmentLength_j / (unitSize+gapSize))` blocks per
 * target `j`, in target order - each run's blocks continue immediately from wherever the *previous*
 * target's run left off, not realigned to that target's own true cumulative pixel boundary
 * (`axis.<x|y>(cumulativeValue)`). Concretely: if segment 0 is short 3px of an exact multiple of
 * `unitSize+gapSize`, segment 1's blocks still start exactly one step after segment 0's last block
 * - 3px "early" relative to where segment 1's true stacked boundary actually falls - a real,
 * faithfully-ported upstream imprecision, not a bug introduced by this port. `gapSize` is
 * `equalizerbar.js`/`equalizercolumn.js`'s own `innerPadding` (the same option as the non-equalizer
 * `BarChart` grouped-bar gap, repurposed as the fixed pixel gap between blocks when `equalizer`
 * mode is on), not `EQUALIZER_BLOCK_GAP` (`equalizer.js`'s own, unrelated, hardcoded 1.5px). Takes
 * `segmentLengths` in target/stacking order (index 0 = base) and returns one block array per
 * segment, same order/length.
 */
export function equalizerStackedBlocks(segmentLengths: number[], unitSize: number, gapSize: number): EqualizerStackedBlock[][] {
  const step = unitSize + gapSize
  if (step <= 0) return segmentLengths.map(() => [])

  const result: EqualizerStackedBlock[][] = []
  let offset = 0
  let guard = 0

  for (const length of segmentLengths) {
    const blocks: EqualizerStackedBlock[] = []
    let remaining = length

    while (remaining >= step && guard++ < EQUALIZER_MAX_BLOCKS) {
      blocks.push({ offset, size: unitSize })
      remaining -= step
      offset += step
    }

    result.push(blocks)
  }

  return result
}

/**
 * Ported from `equalizerbar.js`/`equalizercolumn.js`'s `draw()`: `unit = band / (brush.unit *
 * padding)` where `band` is `axis.<x|y>.rangeBand()` **on the value/range axis** (not a block
 * axis's category-band width) - confirmed from `util.scale.linear.js`'s `rangeBand()`: for a linear
 * scale it's set as a side effect of `ticks()` to `Math.abs(second - first)`, the pixel distance
 * between the first two tick positions (i.e. the pixel width spanned by one tick step of the
 * domain) - a fundamentally different quantity from a block axis's `rangeBand()` (per-category
 * band width), and NOT already exposed by this port's `AxisResult` (`RangeAxisResult.band` is
 * hardcoded `0` - see `useAxis.ts` - since no component needed a range axis's tick-pixel-spacing
 * until now). Since a linear scale is affine, every consecutive tick pair is equidistant in pixel
 * space, so any two adjacent `values[]` entries give the same answer as the source's specific
 * "first two" choice - see `rangeAxisTickBand`. `equalizerUnit` is `equalizerbar.js`/
 * `equalizercolumn.js`'s own `unit` brush option (default `1`) - unrelated to `equalizer.js`'s
 * same-named but semantically different `unit` (a literal pixel block height there; here a
 * divisor). `padding` is `innerPadding` (inherited default `1` from `bar.js`, NOT `equalizer.js`'s
 * own default `10` - the two brushes never share a setup chain, see this port's `BarChart.vue`
 * `equalizer` prop doc comment).
 */
export function equalizerUnitSize(tickBand: number, equalizerUnit: number, innerPadding: number): number {
  const divisor = equalizerUnit * innerPadding
  return divisor !== 0 ? tickBand / divisor : 0
}

/**
 * The pixel width spanned by one tick step of a "range" (linear) axis - `util.scale.linear.js`'s
 * `rangeBand()`, computed here from the axis's already-resolved tick pixel `values[]` array (this
 * port's `RangeAxisResult.values`) rather than reimplementing `ticks()`'s side effect. A linear
 * scale is affine, so any two adjacent tick positions give the same spacing as the source's own
 * "first two ticks" (`Math.abs(second - first)`); this reads `values[0]`/`values[1]` to match that
 * literally. Returns `0` for fewer than 2 ticks (can't derive a spacing - matches the source's own
 * `_rangeBand` staying `null`/unset in that case, which would otherwise divide-by-something-
 * undefined further down `equalizerUnitSize`'s call chain).
 */
export function rangeAxisTickBand(values: number[]): number {
  if (values.length < 2) return 0
  return Math.abs(values[1] - values[0])
}

/**
 * Rounded-rect SVG path, one radius per corner (`tl`/`tr`/`br`/`bl`, clockwise from top-left) - a
 * corner with radius `0` is drawn as a plain right angle (no `A` command), matching how
 * `BarChart.vue`'s own bar/column corners (single-end-rounded, per `bar.js`'s `.round()`) and
 * `ratebar.js`'s per-segment pill ends (its own hand-written `MoveTo`/`LineTo`/`Arc` sequence,
 * functionally identical to this general helper with `tl`/`bl` sharing one radius and `tr`/`br`
 * sharing the other) both need. Extracted here (was previously private to `BarChart.vue`) so
 * `RateBarChart.vue` can reuse it rather than re-deriving the same arc math a third time.
 */
export function roundedRectPath(x: number, y: number, w: number, h: number, tl: number, tr: number, br: number, bl: number): string {
  return [
    `M ${x + tl} ${y}`,
    `L ${x + w - tr} ${y}`,
    tr ? `A ${tr} ${tr} 0 0 1 ${x + w} ${y + tr}` : '',
    `L ${x + w} ${y + h - br}`,
    br ? `A ${br} ${br} 0 0 1 ${x + w - br} ${y + h}` : '',
    `L ${x + bl} ${y + h}`,
    bl ? `A ${bl} ${bl} 0 0 1 ${x} ${y + h - bl}` : '',
    `L ${x} ${y + tl}`,
    tl ? `A ${tl} ${tl} 0 0 1 ${x + tl} ${y}` : '',
    'Z',
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * Ported from `ratebar.js`'s `draw()` inner loop: **not** a call through `axis.x.rate`'s
 * domain-based scale math, even though the source literally calls `axis.x.rate(data[key],
 * sumValues)` - same derivation as `normalizeStackFractions`/`fullstackbar.js` (see that
 * function's doc comment): `func.rate(value, max) = func(func.max() * (value / max))` is linear
 * from a domain starting at 0, so the domain max cancels out algebraically, leaving a plain
 * `(value / sum) * totalPixelSpan` - confirmed against the same `util.scale.linear.js` source used
 * for that derivation. So, like `fullstackbar`'s `normalize` mode, a rate-bar row's segments
 * always span the chart's full plot width regardless of the row's raw total or the x-axis's
 * configured domain - only each segment's *share* of that width (and the `axis.x.max()`-coupled
 * percent label, see `computeStackPercent`) depends on the data.
 *
 * **Genuinely different from `normalizeStackFractions` in one way, not just a rename**: the
 * source pre-filters to `nonZeroKeys = keys.filter(k => data[k] > 0)` *before* summing/laying out
 * - a zero (or negative) value's target is skipped entirely (no zero-width placeholder in the
 * segment list), unlike `normalizeStackFractions`'s dense per-target array. This also changes
 * which segment is "first"/"last" for the rounded pill-end radius (`leftRadius`/`rightRadius` in
 * `ratebar.js`) - it's the first/last *nonzero* segment, not the first/last *target*. Returns pixel
 * `x`/`width` (not `[0,1]` fractions like `normalizeStackFractions`) since the percent label needs
 * `sum` anyway and every caller wants pixels immediately - no caller needs the fraction form here.
 */
export interface RateBarSegment {
  key: string
  value: number
  /** `Math.round((value / sum) * axisMax)` - see `computeStackPercent`'s own doc comment on the
   * domain-max coupling (only a true 0-100 percentage when the x-axis's configured domain max is
   * `100`). */
  percent: number
  /** Pixel offset from the row's own start edge (i.e. relative to the plot area's left edge, not
   * yet including it - the caller adds `area.x`). */
  x: number
  width: number
  /** First nonzero-value segment in the row - gets the left pill-end radius. */
  isFirst: boolean
  /** Last nonzero-value segment in the row - gets the right pill-end radius. */
  isLast: boolean
}

export function rateBarSegments(row: DataRow, targets: string[], totalWidth: number, axisMax: number): RateBarSegment[] {
  const nonZeroKeys = targets.filter((k) => (row[k] as number) > 0)
  const sum = nonZeroKeys.reduce((acc, k) => acc + (row[k] as number), 0)

  const segments: RateBarSegment[] = []
  let x = 0

  nonZeroKeys.forEach((key, j) => {
    const value = row[key] as number
    const width = sum !== 0 ? (value / sum) * totalWidth : 0
    const percent = computeStackPercent(value, sum, axisMax)

    segments.push({ key, value, percent, x, width, isFirst: j === 0, isLast: j === nonZeroKeys.length - 1 })
    x += width
  })

  return segments
}

/**
 * Ported from `ratebar.js`'s `draw()` row-vertical-placement math: `height = axis.y.rangeBand() -
 * tooltipSize - padding/2` (the row's own band minus room for the tooltip flag above the bar, and
 * half the `padding` option), then `startY = offset("y", i) - height/2 + tooltipSize/2` (the bar's
 * top edge - centered in the band, then nudged down by half the reserved tooltip gap so the flag
 * has somewhere to sit above the bar without overlapping the row above it). `centerY` is this
 * port's `ay.scale(i)` (already the block axis's centered pixel position for row `i` - `offset()`
 * adds no further `rangeBand()/2` for a "block" axis, per `chart.brush.core`'s own `offset()`).
 */
export function rateBarRowLayout(centerY: number, band: number, tooltipSize: number, barPadding: number): { y: number; height: number } {
  const height = band - tooltipSize - barPadding / 2
  const y = centerY - height / 2 + tooltipSize / 2
  return { y, height }
}

/**
 * Ported from `ratebar.js`'s `setActiveBarElement(activeIndex, activeTarget)` - **source-confirmed
 * subtlety, easy to get wrong by assuming it dims every OTHER bar in the whole chart** (the way
 * `bar.js`'s own flat-index `active` or `stackbar.js`'s row-level `active` do): re-reading the
 * source's nested loop closely, the dim condition is `activeIndex == index && activeTarget != key`
 * - it only fires for a segment in the SAME row as `activeIndex`, and only when that segment's own
 * key differs from `activeTarget`. A segment in any OTHER row is never dimmed (always opacity 1),
 * and the exact matching `(activeIndex, activeTarget)` segment is also never dimmed - so the
 * visible effect is "dim this ONE row's other segments, leave every other row alone", not
 * "highlight one segment against the whole chart". `activeIndex`/`activeTarget` default `null`
 * (nothing dimmed, matching `!= null` guards on both).
 */
export function rateBarActiveOpacity(rowIndex: number, key: string, activeIndex: number | null, activeTarget: string | null, disabledOpacity: number): number {
  const dimmed = activeIndex != null && activeIndex === rowIndex && activeTarget != null && activeTarget !== key
  return dimmed ? disabledOpacity : 1
}
