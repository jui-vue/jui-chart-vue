/**
 * Hand-ported from `jui-chart/src/brush/canvas/equalizercolumn.js` (256 lines,
 * `chart.brush.canvas.equalizercolumn`). Confirmed genuine chart-rendering-domain code per
 * PORT_STATUS.md's Phase E policy test - named explicitly in the policy section's own "confirmed
 * genuine chart-engine" list - so hand-ported, not vendored.
 *
 * **`extend` chain, confirmed from source**: `extend: "chart.brush.canvas.core"` -> `"chart.brush.
 * core"`, the SAME chain as `activecircle.js`/`activebubble.js`/`bubblecloud.js`. `chart.brush.
 * canvas.core`'s own `addPolygon()`/3D depth-sorting `drawAfter()` are dead here too (grepped the
 * full 256 lines: zero references to `addPolygon`/`calculate3d`/`this.polygons`).
 *
 * **NOT 3D, confirmed from a full read - "equalizer" is a 2D bar/column visual with an animated
 * level-meter overlay, nothing more**: this file never references `chart.polygon.*`, never builds
 * a vertex/matrix, never calls anything from `juijs-graph/src/polygon/*` (the engine `dot3d.js`/
 * `usePolygon3d.ts` wrap). Every draw call is a plain 2D `canvas.rect()`/`moveTo`/`lineTo`/`arcTo`/
 * `fillText` against `this.axis.x`/`this.axis.y` (real axis/scale positions, same "axis-based
 * canvas brush" shape `activecircle.js` established - reuses `useChartLayout.ts`/`useAxis.ts`
 * as-is, no new axis/layout composable needed). **`usePolygon3d.ts` is not used anywhere in this
 * port** - there is nothing 3D to reuse it for.
 *
 * **Block-train stacking math is IDENTICAL to the already-ported SVG sibling
 * (`equalizerbar.js`/`equalizercolumn.js` behind `BarChart.vue`'s `equalizer` prop, Phase B)**:
 * confirmed by diffing `jui-chart/src/brush/equalizercolumn.js`'s `draw()` against this file's -
 * same `unit = band / (brush.unit * innerPadding)`, same `while (targetY >= height)` block-train
 * loop, same running-position-never-resets-between-targets quirk `equalizerStackedBlocks`'s own
 * doc comment (`useSeries.ts`) already documents in detail. **Reused directly here, not
 * re-derived**: `equalizerStackedBlocks`/`equalizerUnitSize`/`rangeAxisTickBand` (`useSeries.ts`),
 * exactly like `BarChart.vue`'s own `equalizer` prop path - this is the "extract once 2+ consumers
 * need the same thing" convention paying off for a second, canvas-backend consumer.
 *
 * **Two CONFIRMED-DEAD fields in the source's own `getBarElement()`, verified by a full read of
 * `draw()` - simplified out of this port since they have ZERO effect on rendered pixels**:
 * 1. `stroke`/`stroke-width`/`stroke-opacity` are computed and assigned to the canvas context
 *    (`this.canvas.strokeStyle = r.stroke; ...strokeOpacity = ...; ...lineWidth = ...`) but
 *    `this.canvas.stroke()` is **never called** anywhere in the block-drawing loop - only
 *    `.fill()`. Border config is inert for every block. (`strokeOpacity` is also not a real
 *    `CanvasRenderingContext2D` property at all - assigning to it is a silent no-op even before
 *    considering the missing `.stroke()` call.)
 * 2. `hidden: value == 0` is computed but never read anywhere after `getBarElement()` returns - no
 *    `if (r.hidden)` guard exists before drawing. A zero-value target still draws a
 *    zero-height/zero-block-count segment (an empty loop, not a skipped one) - same visual
 *    result either way, so dropping the flag changes nothing observable.
 * Only `fill` (color) and `fill-opacity` (from the `active` index check) have any real effect -
 * this port's block-drawing keeps only those.
 *
 * **A real, PRESERVED save/restore stack imbalance in the error-column flag draw (lines 130-150)**:
 * the source calls `this.canvas.save()` TWICE (once before the flag path fill, once again before
 * the rotated-text draw) but `this.canvas.restore()` only ONCE (after the text). Net effect: one
 * unbalanced `save()` per error-column draw, leaving the flag's `fillStyle`/`beginPath` state
 * pushed on the context's stack indefinitely. Confirmed a real source bug, not a misreading -
 * ported literally (`drawEqualizerErrorFlag` below does the same save/save/restore(1) sequence),
 * not "fixed" to a balanced pair.
 *
 * **A second real, PRESERVED bug**: the animated total-label's `font` is set to
 * `` `${theme("barFontSize")}px` `` with NO font-family at all (contrast the error flag's own font,
 * which correctly includes `theme("fontFamily")`) - browsers fall back to a default sans-serif.
 * Ported literally in the component, not "fixed" to add a family.
 *
 * **A real, source-confirmed REDUNDANT draw, simplified here (zero pixel difference, not a
 * behavior change)**: for an error column, the flag-drawing branch sits INSIDE the per-target
 * `for (j...)` loop, and nothing in that branch advances the row's shared `y` position (unlike the
 * non-error branch's `while` loop) - so for a 3-target row, the IDENTICAL flag is drawn 3 times at
 * the exact same coordinates with the same opaque fill. Byte-identical output to drawing it once;
 * this port draws it once per error row instead of once per target, documented rather than
 * silently dropped.
 *
 * **Two NEW canvas-only cache keys (not present in the SVG sibling), consumed downstream by this
 * port's own raycast wiring (`useRaycast.ts`) instead of `widget/raycast.js`'s
 * `chart.getCache('raycast_area_' + i)`/`chart.setCache(...)`**: `raycast_area_${i}` (this row's
 * hit-test rect: `x1`/`x2` from the column's left/right edge, `y1` the LAST pushed block's `y`
 * (whatever that is - not necessarily the visual topmost, matching source's unconditional
 * `stackList[stackList.length-1].y`), `y2` the y-axis's absolute-min-value pixel position via
 * `LinearScale.min()` + `scale()`, matching `this.axis.y(this.axis.y.min())` exactly - see
 * `useActiveCircle.ts`'s header comment for why `LinearScale.min()`/`.max()` already match
 * `axis.y.min()`/`.max()`) and `equalizer_${i}` (the same last-pushed block, read back by the
 * per-frame bounce animation for its line/text position - see `stepEqualizerBounce` below).
 *
 * **The animation itself (`drawAnimation()`, ported as `stepEqualizerBounce` + the component's own
 * render call)**: a sawtooth bounce confined to `[-MAX_DISTANCE, 0]` - `UP_SEC_PER_MOVE=20`px/s
 * while `direction===-1` (moving away from the block's top edge, toward `-MAX_DISTANCE`),
 * `DOWN_SEC_PER_MOVE=30`px/s once `direction` flips to `1` (returning toward `0`, faster than the
 * outbound leg despite the "DOWN" name - preserved literally, not renamed for intuitiveness).
 * `equalizer_move_${i}`'s status has NO reset hook anywhere in source (no `drawBefore`-driven
 * clear) - it persists for the brush's entire lifetime, matching `activecircle.js`'s own
 * never-reset `active_circle` cache precedent. Only rows with at least one drawn block ever get
 * this animation (source's `if (stackList.length > 0)` guard before either cache write) - error
 * rows and rows whose combined value never reaches one full `unit+innerPadding` step get neither
 * a cached block nor a bounce.
 */

export type EqualizerColumnActiveSelector = number | number[] | null

/**
 * Ported from `getBarElement()`'s `(active/error).includes|===` opacity check - the ONLY part of
 * `getBarElement()` with a real rendering effect (see this file's header comment). `active === null`
 * (the default) means "nothing is dimmed," matching neither branch of the source's `||` ever being
 * true for `null`.
 */
export function isDisabledIndex(active: EqualizerColumnActiveSelector, i: number): boolean {
  if (Array.isArray(active)) return !active.includes(i)
  if (typeof active === 'number') return active !== i
  return false
}

/**
 * Ported from `isErrorColumn(i)` literally, including its de-Morgan-inverted `return false` guard
 * clauses (`array && !includes`, `integer && !==`, or `error === null` all mean "not an error
 * column"). The unreachable `return true` fallback (`error` is neither an array, a number, nor
 * `null`) is kept for source fidelity even though `EqualizerColumnActiveSelector`'s own type can't
 * actually produce it.
 */
export function isErrorColumn(error: EqualizerColumnActiveSelector, i: number): boolean {
  if (Array.isArray(error)) return error.includes(i)
  if (typeof error === 'number') return error === i
  if (error === null) return false
  return true
}

/**
 * Ported from `getTargetSize()`: `brush.size > 0` wins outright; otherwise the category band minus
 * `outerPadding` on both sides, floored at `minSize`.
 */
export function getTargetColumnWidth(bandWidth: number, size: number, outerPadding: number, minSize: number): number {
  if (size > 0) return size
  const computed = bandWidth - outerPadding * 2
  return computed < minSize ? minSize : computed
}

/** One error-column flag's derived geometry - ported from `draw()`'s error branch (lines 121-128),
 *  a fixed-proportion "flag" shape pointing at `(offsetX, y)`. `round` (the corner radius) is the
 *  source's own hardcoded `5`, not derived from any input. */
export interface ErrorFlagGeometry {
  size: number
  height: number
  tick: number
  startX: number
  fontSize: number
  yt: number
  yht: number
  round: number
}

export function computeErrorFlagGeometry(offsetX: number, y: number, xBandWidth: number, plotAreaHeight: number): ErrorFlagGeometry {
  const size = Math.min(xBandWidth, plotAreaHeight) * 0.4
  const height = plotAreaHeight * 0.5
  const tick = size * 0.3
  const startX = offsetX - size / 2
  const fontSize = height / 5
  const yt = y - tick
  const yht = y - height - tick
  const round = 5
  return { size, height, tick, startX, fontSize, yt, yht, round }
}

/** The bounce animation's persisted per-row state - ported from `drawAnimation()`'s
 *  `chart.getCache('equalizer_move_' + i, { direction: -1, distance: 0 })` default. */
export interface EqualizerBounceStatus {
  direction: number
  distance: number
}

export const EQUALIZER_BOUNCE_MAX_DISTANCE = 8
export const EQUALIZER_BOUNCE_UP_SPEED = 20
export const EQUALIZER_BOUNCE_DOWN_SPEED = 30
/** `drawAnimation()`'s own pixel offsets, applied by the component when rendering the line/text -
 *  kept here alongside the speed/distance constants they're used with. */
export const EQUALIZER_BOUNCE_TOP_PADDING = -3
export const EQUALIZER_BOUNCE_TOTAL_PADDING = -8

/**
 * Ported from `drawAnimation()`'s per-frame status update (lines 190-206) - see this file's header
 * comment for the exact bounce shape. Pure and hand-traceable: does NOT read/write any cache
 * itself, the caller owns persisting the returned status across frames (matching this port's
 * established `step()`-returns-next-state convention, e.g. `computeCenterGravityStep`).
 */
export function stepEqualizerBounce(status: EqualizerBounceStatus, tpf: number): EqualizerBounceStatus {
  const speed = status.direction === -1 ? EQUALIZER_BOUNCE_UP_SPEED : EQUALIZER_BOUNCE_DOWN_SPEED
  let distance = status.distance + status.direction * speed * tpf
  let direction = status.direction

  if (Math.abs(distance) >= EQUALIZER_BOUNCE_MAX_DISTANCE) {
    direction = 1
  } else if (distance >= 0) {
    direction = -1
  }

  if (distance < -EQUALIZER_BOUNCE_MAX_DISTANCE) {
    distance = -EQUALIZER_BOUNCE_MAX_DISTANCE
  } else if (distance > 0) {
    distance = 0
  }

  return { direction, distance }
}
