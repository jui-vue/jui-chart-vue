import type { AxisResult } from './useAxis'

/**
 * Pure positioning/snapping helpers shared by `LineChart.vue`'s `guideline`/`crosshair` props -
 * ported from `widget/guideline.js` (a single line that SNAPS to the nearest data row along the x
 * axis, pairing with a full per-series value tooltip) and `widget/cross.js` (a crosshair that
 * tracks the RAW, un-snapped mouse position on either/both axes, pairing with a simple per-axis
 * value readout). These are genuinely different interaction models, confirmed by reading both
 * sources in full (see LineChart.vue's own header comment for the full writeup + why both are
 * still worth porting rather than folding one into the other) - this file exists because both
 * happen to need the SAME two primitives (pointer-to-SVG-space conversion, and "what data/axis
 * value is under this pixel"), not because the widgets themselves are the same feature. Same
 * "layout math is pure and testable, DOM measurement isn't" split as `tooltipMeasure.ts`/
 * `useLegend.ts` - `getBoundingClientRect()` itself stays in `LineChart.vue`.
 */

export interface PointerRect {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Converts a mouse event's client coordinates into this chart's own SVG user-unit (viewBox)
 * space, accounting for `max-width: 100%` having scaled the rendered SVG down from its
 * `width`/`height` attributes - same concern/formula as `TopologyChart.vue`'s own
 * `toViewportPoint()` (ported from `widget/topologyctrl.js`), factored out here as a pure
 * function over an already-measured `rect` so it's unit-testable without a real DOM.
 */
export function toSvgPoint(clientX: number, clientY: number, rect: PointerRect, targetWidth: number, targetHeight: number): { x: number; y: number } {
  const scaleX = rect.width > 0 ? targetWidth / rect.width : 1
  const scaleY = rect.height > 0 ? targetHeight / rect.height : 1
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Index of the data row whose x pixel position is closest to `pointerX`. `positions` is one pixel
 * value per row (typically a single target's own `SeriesPoint.x`, since every target shares the
 * same per-row x position whenever the x axis is `block`-type - see `useSeries.ts`'s own doc
 * comment). Returns `-1` for an empty array.
 *
 * Deliberately NOT ported from `guideline.js`'s own domain/interval-division snap math
 * (`Math.floor((time - domainStart) / (domainRange / data.length))`), which assumes the x domain
 * is a `range`-type (numeric) axis with rows evenly spaced across it - this port's x axis is at
 * least as often `block`-type (categorical), where that formula doesn't apply at all. Snapping
 * directly off the already-rendered pixel positions instead works identically for either axis
 * type, generalizing the original rather than special-casing it - see `LineChart.vue`'s guideline
 * note for the full writeup.
 */
export function nearestIndexByPosition(positions: readonly number[], pointerX: number): number {
  let best = -1
  let bestDist = Infinity
  for (let i = 0; i < positions.length; i++) {
    const dist = Math.abs(positions[i] - pointerX)
    if (dist < bestDist) {
      bestDist = dist
      best = i
    }
  }
  return best
}

/**
 * The axis value under a raw (un-snapped) pixel position - ported from `cross.js`'s
 * `axis.x.invert(e.chartX)`/`axis.y.invert(e.chartY)`. For a `range` axis this is just the
 * scale's own `invert()` (a continuous numeric value); for a `block` axis, `OrdinalScale.invert()`
 * (see `useScale.ts`) returns a domain INDEX with no upper clamp of its own (it can run past the
 * last tick beyond the axis's far edge), so this clamps into `[0, ticks.length - 1]` before
 * mapping back to the tick label - `cross.js` has no equivalent guard (its own `axis.x`/`axis.y`
 * are always `range`-type in the original engine's crosshair usage), but this port's x/y axes can
 * be `block`-type too, so the clamp is new behavior needed here.
 */
export function invertAxisValue(axis: AxisResult, pixel: number): string | number {
  if (axis.type === 'block') {
    const rawIndex = axis.scale.invert(pixel)
    const index = clamp(rawIndex, 0, axis.ticks.length - 1)
    return axis.ticks[index]
  }
  return axis.scale.invert(pixel)
}
