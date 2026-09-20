import type { DataRow } from '../types'

/**
 * `BubbleChart`'s pure logic, ported from `chart.brush.bubble`. Confirmed from source
 * (`src/brush/bubble.js`): `BubbleBrush` `extend`s `chart.brush.core` directly (NOT
 * `chart.brush.scatter`) - it's a separate implementation, not scatter-plus-radius, though it
 * shares the same `getXY()` positioning `useSeries` already provides (one categorical/index axis,
 * one value axis per `target` - same dot/strip-plot data model as `ScatterChart`, see its header
 * comment). Bubble only adds a 3rd, radius-encoded dimension on top of that (x, y) position.
 */

/**
 * Ported from `util.math`'s `scaleValue()`: linearly maps `value` from `[minValue, maxValue]`
 * into `[minScale, maxScale]`. `minValue` is coerced to `0` when it equals `maxValue` (matching
 * the original's identical, slightly odd zero-division guard - ported literally, not "fixed").
 */
export function scaleValue(value: number, minValue: number, maxValue: number, minScale: number, maxScale: number): number {
  const mn = minValue === maxValue ? 0 : minValue
  const range = maxScale - minScale
  const per = (value - mn) / (maxValue - mn)
  return range * per + minScale
}

/** Min/max of `field` across every row, ignoring non-numeric values. */
function fieldMinMax(data: DataRow[], field: string): { min: number; max: number } {
  let min = Infinity
  let max = -Infinity
  for (const row of data) {
    const v = row[field]
    if (typeof v !== 'number') continue
    if (v < min) min = v
    if (v > max) max = v
  }
  return { min, max }
}

/**
 * Ported from `BubbleBrush.drawBefore()`: the `[min, max]` domain `scaleValue()` maps radius
 * values FROM.
 *
 * - With `scaleKey` set: the min/max of that raw field across every row (`this.axis.data`),
 *   independent of `target` - matches `drawBefore()`'s own dedicated loop over `axis.data`.
 * - Without it: the original hardcodes `this.axis.y.min()/max()` - i.e. it assumes the y-axis is
 *   always the numeric "range" axis (same baked-in assumption `getXY()` makes for the whole dot/
 *   strip-plot data model - see this file's header comment) and reuses its *resolved* domain
 *   bounds (post "nice" rounding), not a raw per-target min/max. `yRangeDomain` is that resolved
 *   `{min, max}` when the caller's y-axis is indeed `type: "range"`, or `null` otherwise.
 * - **Deviation (robustness only, not a behavior change for any faithfully-configured chart)**:
 *   when `yRangeDomain` is `null` (a block y-axis - a configuration upstream never guards against
 *   and would simply crash on, since a block axis has no `.min()/.max()`), this falls back to the
 *   raw min/max across every `target` field instead of throwing, so a differently-oriented Bubble
 *   chart still renders something sensible rather than crashing.
 */
export function bubbleRadiusDomain(data: DataRow[], target: string[], scaleKey: string | null | undefined, yRangeDomain: { min: number; max: number } | null): { min: number; max: number } {
  if (scaleKey != null) return fieldMinMax(data, scaleKey)
  if (yRangeDomain) return yRangeDomain

  let min = Infinity
  let max = -Infinity
  for (const key of target) {
    const mm = fieldMinMax(data, key)
    if (mm.min < min) min = mm.min
    if (mm.max > max) max = mm.max
  }
  return { min, max }
}

/**
 * Ported from `getBubbleRadius()`: resolves the radius-driving raw value for one bubble - the
 * row's `scaleKey` field when it's set AND numeric (`_.typeCheck("number", scaleValue)`), else
 * the point's own target `value` unchanged - then scales it into `[minRadius, maxRadius]` via
 * `scaleValue()`/`domain` (see `bubbleRadiusDomain`).
 */
export function bubbleRadius(value: number, row: DataRow | undefined, scaleKey: string | null | undefined, domain: { min: number; max: number }, minRadius: number, maxRadius: number): number {
  let v = value
  if (scaleKey != null && row) {
    const raw = row[scaleKey]
    if (typeof raw === 'number') v = raw
  }
  return scaleValue(v, domain.min, domain.max, minRadius, maxRadius)
}

/**
 * Ported from `getFormatText()`: the label shown inside a bubble when `showText` is on. A
 * `format` callback (if given) receives the *whole raw data row* (`this.format(this.axis.data[
 * dataIndex])`) - unlike every other chart component's `format(value)` - else falls back to the
 * point's own raw target `value` unchanged (not the possibly-`scaleKey`-substituted radius value).
 */
export function bubbleFormatText(value: number, row: DataRow, format: ((row: DataRow) => string | number) | undefined): string | number {
  return format ? format(row) : value
}
