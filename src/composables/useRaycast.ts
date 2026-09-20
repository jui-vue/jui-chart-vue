/**
 * Hand-ported from `jui-chart/src/widget/raycast.js` (68 lines, `chart.widget.raycast`, internal
 * class name `DragSelectWidget` - a leftover/copy-paste artifact from an unrelated widget, not a
 * naming hint about this file's own behavior). `extend: "chart.widget.core"`, the same chain as
 * every other Phase D/E widget.
 *
 * **NOT a nearest-point/ray-intersection/spatial-index hit-test, and NOT 3D** - confirmed by a full
 * read (already investigated once, in Phase D, before this brush existed - see PORT_STATUS.md's
 * `raycast.js` entry there for the original investigation this one supersedes). It's a plain
 * axis-aligned point-in-rectangle test against a cached area, gated by resolving a "block" axis
 * category index from the click's x position. No `chart.polygon.*`, no rotation/perspective matrix,
 * no relation whatsoever to `dot3d.js`/`usePolygon3d.ts`'s 3D engine - the "raycast" name is
 * misleading.
 *
 * **Real dependency graph, confirmed by grepping the FULL `jui-chart` + `juijs-graph` tree for both
 * cache keys this file and `widget/canvas/picker.js` read**: this file's `raycast_area_*` cache key
 * has exactly ONE writer anywhere in the source tree - `brush/canvas/equalizercolumn.js`
 * (`useEqualizerColumn.ts`). `widget/canvas/picker.js`'s own `'picker'` cache key has a DIFFERENT,
 * unrelated sole writer - `brush/canvas/bubblecloud.js` (already ported, `useBubbleCloud.ts`/
 * `BubbleCloudChart.vue`). **`equalizercolumn.js` does NOT use `picker.js`, and `picker.js` does
 * NOT use this file** - they are two independent, parallel brush<->widget pairs that happen to live
 * in sibling files and share a superficially similar "canvas click hit-test" shape, not a chain
 * (`equalizercolumn -> picker -> raycast`, as an earlier PORT_STATUS.md note spot-guessed before
 * this iteration's own source investigation). Confirmed against both brushes' own example HTML:
 * `examples/equalizercolumn.html` wires `widget: [{type: "raycast"}]` only; `examples/
 * bubblecloud.html` wires `widget: [{type: "canvas.picker"}]` only - neither example uses the
 * other's widget.
 *
 * **`e.chartX` vs. this port's canvas-absolute coordinates**: the original's `setMouseEvent()`
 * (`brush/core.js`) computes `e.chartX = offsetX - chart.padding("left")` (canvas-root-relative
 * minus chart padding) specifically because the original's canvas 2D context is `translate()`d by
 * the SAME padding before each brush draws (`base/builder.js`'s `context.translate(_area.x,
 * _area.y)`) - so `e.chartX` and `this.axis.x(value)` end up in the same translated, padding-local
 * frame. This port's `ChartCanvasBase.vue` never calls `ctx.translate` and `useChartLayout.ts`'s
 * axis scales already bake padding into their interval (confirmed via `ActiveCircleChart.vue`'s
 * direct `ctx.arc(scaleX(x), scaleY(y), ...)` calls onto an untranslated canvas) - so this port's
 * single canvas-absolute frame (native `MouseEvent.offsetX`/`offsetY`, matching
 * `BubbleCloudChart.vue`'s already-established `cloud.pick(event.offsetX, event.offsetY)` call)
 * plays the role of the original's TWO-frame split in one. No padding subtraction is needed here.
 *
 * **Block-index resolution, Node-cross-checked (not assumed) against the original's own
 * `grid/block.js` `func.invert(x) = Math.ceil(x / rangeBand)` (1-indexed) + `raycast.js`'s own
 * `- 1`**: this port's `OrdinalScale.invert()` (`useScale.ts`, already used by `useHoverGuide.ts`'s
 * `invertAxisValue` for `cross.js`) computes `floor(abs(x - (range[0]-unit/2)) / unit)`, which -
 * once `x` is converted from this port's canvas-absolute frame back to the original's plot-local
 * one (`x_abs - interval0`) - is algebraically `ceil(rawX/unit) - 1` for every NON-boundary `x`
 * (floor(t) === ceil(t)-1 whenever `t` isn't an exact integer). A 1428-sample sweep at a
 * non-aligned step (`/tmp/verify_invert.js` during this port) across a realistic 4-category/600px
 * chart found exactly ONE disagreement: `x` landing on an EXACT category boundary pixel (floor
 * assigns it to the block starting there; the original's ceil-then-`-1` assigns it to the block
 * ending there, one index lower) - an inherent floor-vs-ceil boundary tie-break, not a bug, and
 * unreachable in practice with real (sub-pixel, rarely-exact) click coordinates. **Conclusion: this
 * port's existing `axis.scale.invert(canvasX)` (no extra `-1`) already reproduces
 * `blockAxis.invert(e.chartX) - 1` for real click positions** - reused directly below via
 * `resolveRaycastBlockIndex`, not re-derived.
 *
 * **`rangeAxis` is a confirmed-dead parameter of `emitBlockAndRangeEvent`** - `setRayCastEvent`
 * only checks `blockAxis != null && rangeAxis != null` as a GATE before wiring the click listener
 * at all (i.e. "one block axis and one range axis must both exist"); the hit-test itself never
 * reads `rangeAxis`. `equalizercolumn.js`'s own chart always has `x: block` / `y: range`, so this
 * port's `EqualizerColumnChart.vue` folds that gate into its own `axisX.type === 'block' && axisY.
 * type === 'range'` guard rather than threading an unused parameter through.
 *
 * **Vue integration shape**: `raycast.js`'s own `draw()` returns an empty `<g>` and does nothing
 * but wire chart-wide click listeners - no independent visual surface, no state a sibling
 * component could need to introspect (matches this port's established "opt-in behavior on the host
 * component" bucket, same reasoning as `BubbleCloudChart.vue`'s own direct `pick()` wiring instead
 * of a standalone widget component). `EqualizerColumnChart.vue` therefore calls
 * `resolveRaycastBlockIndex`/`raycastPick` directly from its own native `@click` handler and
 * exposes the result, rather than introducing a new widget component or a `ChartCanvasBase.vue`
 * prop/event.
 */

import type { AxisResult } from './useAxis'

/** One row's cached hit-test rectangle - ported from `equalizercolumn.js`'s own
 *  `raycast_area_${i}` cache value shape (`x1`/`x2`/`y1`/`y2`), NOT from `raycast.js` itself
 *  (which only ever reads this shape, never constructs it). */
export interface RaycastArea {
  x1: number
  x2: number
  y1: number
  y2: number
}

/**
 * Ported from `emitBlockAndRangeEvent`'s point-in-rectangle test (the ENTIRE geometric content of
 * `raycast.js`): `x1 <= x <= x2 && y1 <= y <= y2`, inclusive on both ends, exactly as source.
 */
export function raycastHitTest(area: RaycastArea, x: number, y: number): boolean {
  return x >= area.x1 && x <= area.x2 && y >= area.y1 && y <= area.y2
}

/**
 * Ported from `blockAxis.invert(e.chartX) - 1` - see this file's header comment for the
 * Node-cross-checked derivation of why this port's existing `OrdinalScale.invert()` already
 * produces the same 0-indexed result with no further `-1` adjustment. `axisX` must be a `'block'`
 * axis (the caller's own responsibility to check, matching `setRayCastEvent`'s
 * `blockAxis != null` gate) - `NaN`/out-of-range results are handled naturally by
 * `raycastPick`'s cache-miss check below (no cached area for an out-of-range index), matching
 * source's own lack of an explicit clamp.
 */
export function resolveRaycastBlockIndex(axisX: AxisResult, canvasX: number): number {
  return axisX.scale.invert(canvasX)
}

/**
 * Ported from `emitBlockAndRangeEvent`'s full body: cache lookup (miss -> no hit) + the rectangle
 * test above, returning the matched row + its index (matching the emitted event's own `{data,
 * dataIndex}` shape) or `null`. `areas`/`data` are this port's per-row equivalents of
 * `chart.getCache('raycast_area_' + blockValue)` / `axis.data`.
 */
export function raycastPick<T>(areas: ReadonlyMap<number, RaycastArea>, data: readonly T[], blockIndex: number, x: number, y: number): { data: T; dataIndex: number } | null {
  const area = areas.get(blockIndex)
  if (area == null) return null
  if (!raycastHitTest(area, x, y)) return null
  return { data: data[blockIndex], dataIndex: blockIndex }
}
