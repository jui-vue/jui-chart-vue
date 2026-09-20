/**
 * Pure logic for `SelectBoxChart.vue`, ported from `selectbox.js` (72 lines, `extend:
 * "chart.brush.core"` directly). See `SelectBoxChart.vue`'s header comment for the full source
 * derivation and the deliberate deviation this file embodies.
 *
 * **Source-confirmed scope decision**: `selectbox.js`'s `drawBefore()` calls
 * `this.axis.x.ticks("milliseconds", this.axis.get("x").interval)` - a signature that only exists
 * on `util.scale.time` (jui-chart's date/time scale, used by its `chart.grid.date`/
 * `chart.grid.dateblock` axis types), NOT on the plain linear/ordinal scales this port has ported
 * (`useScale.ts`). This port has no date/time axis type at all (a real, substantial gap - adding
 * one would mean a new `AxisConfig` variant plus `ChartBase.vue` rendering support, out of scope
 * for this item). However, re-reading `util/scale/time.js`'s `ticks(type, interval)` closely shows
 * the unit argument selectbox.js passes is the LITERAL STRING `"milliseconds"` (hardcoded, not
 * read from any config) - and `util/time.js`'s `add(date, "milliseconds", interval)` is just
 * `date.setMilliseconds(date.getMilliseconds() + interval)`, i.e. plain numeric addition with no
 * calendar-unit complexity (unlike a `"months"`/`"years"` bucket, which would need real calendar
 * arithmetic). So this specific call site's real behavior is exactly "step from the domain start
 * by a constant millisecond `interval` until passing the domain end" - a pure linear-stepping
 * function with zero date-specific behavior. This port therefore implements that exact stepping
 * math directly against the EXISTING `range`-type (linear numeric) x-axis - the caller supplies a
 * numeric domain field (e.g. an epoch-millisecond timestamp) and an `interval` (ms) prop - rather
 * than building an entire new date-axis subsystem to support one brush.
 *
 * **Also deliberately NOT reproduced**: `selectbox.js` reads `width = this.axis.x.rangeBand()`
 * BEFORE calling `this.axis.x.ticks(...)` in the same `drawBefore()` - only valid because the
 * SHARED axis-grid scale object had already called `.ticks()` once during its own (earlier) grid
 * render pass, as a mutable side effect populating `_rangeBand`. This port computes `width`
 * directly from its own freshly-computed `ticks` array (`selectBoxCells`'s own
 * `scaleX(ticks[1]) - scaleX(ticks[0])`) instead of depending on that call-order coupling with a
 * shared, external scale object - a robustness improvement, not a behavior change (the *value* is
 * identical: the pixel distance between the first two ticks).
 */

/**
 * Ported from `util/scale/time.js`'s `ticks(type, interval)` with `type` fixed to `"milliseconds"`
 * (see this file's header comment - the only unit `selectbox.js` ever actually passes): steps from
 * `domainMin` by `interval` until reaching or passing `domainMax`, then pushes that final
 * (possibly overshooting) value - the original never clamps the last tick to exactly `domainMax`.
 *
 * A non-positive `interval` would make the original's underlying `while (start < end)` loop
 * infinite (`setMilliseconds(x + 0)` never advances `start`) - this port guards that case
 * (returns `[]`) as a deliberate, documented safety net, not a silently-added feature: the source
 * has no such guard because it can't safely be reached (a real `Date` object's `setMilliseconds`
 * would still be an infinite loop upstream too).
 */
export function selectBoxTicks(domainMin: number, domainMax: number, interval: number): number[] {
  if (interval <= 0) return []

  const ticks: number[] = []
  let start = domainMin
  while (start < domainMax) {
    ticks.push(start)
    start += interval
  }
  ticks.push(start)

  return ticks
}

export interface SelectBoxCell {
  start: number
  end: number
  x: number
  width: number
}

/**
 * Ported from `selectbox.js`'s `draw()` loop (`for (i = 0; i < ticks.length - 1; i++)`): one cell
 * per consecutive tick pair. `width` is computed ONCE from the first two ticks' pixel positions
 * and reused for every cell (matching the source's own `rangeBand()`-for-all-cells shape) - so a
 * shorter final bucket (when `interval` doesn't evenly divide the domain span) still gets the
 * SAME width as every other cell, which can overshoot past the axis's own domain-max pixel. This
 * is a faithful, deliberately-preserved quirk, not a bug in this port.
 */
export function selectBoxCells(ticks: number[], scaleX: (value: number) => number | null): SelectBoxCell[] {
  if (ticks.length < 2) return []

  const x0 = scaleX(ticks[0]) ?? 0
  const x1 = scaleX(ticks[1]) ?? 0
  const width = x1 - x0

  const cells: SelectBoxCell[] = []
  for (let i = 0; i < ticks.length - 1; i++) {
    cells.push({
      start: ticks[i],
      end: ticks[i + 1],
      x: scaleX(ticks[i]) ?? 0,
      width,
    })
  }

  return cells
}
