import { onBeforeUnmount, ref, type ComputedRef, type Ref } from 'vue'
import { toSvgPoint } from './useHoverGuide'

/** Accepts either a plain writable `ref()` or a `computed()` - this composable only ever READS
 *  these inputs, so a caller (e.g. a `computed(() => templateRef.value?.$el ?? null)` for `elRef`)
 *  shouldn't need to launder it through a writable ref just to satisfy the type. */
type ReadonlyRefLike<T> = Ref<T> | ComputedRef<T>

/**
 * Hand-ported from `jui-chart/src/widget/polygon/rotate3d.js` (92 lines, `chart.widget.polygon.
 * rotate3d`). **Not vendored in `node_modules/juijs-graph` at all** - unlike every other Phase E
 * file so far (which live in the separate `juijs-graph` npm package under `node_modules/`), this
 * widget only exists in `jui-chart/src/widget/polygon/` itself (confirmed: `diff` against
 * `node_modules/juijs-graph/src/widget/polygon/` finds no such directory there, and
 * `node_modules/juijs-graph/src/widget/` only has `core.js`/`canvas/core.js`/`map/core.js`/
 * `polygon/core.js` - no `rotate3d.js`). No license header anywhere in the chain
 * (`rotate3d.js`/`chart.widget.polygon.core`/`chart.widget.core`), and a web search for its own
 * distinctive identifiers ("PolygonRotate3DWidget", `"chart.widget.polygon.rotate3d"`, the
 * `dx % unit != 0 && dy % unit != 0` guard shape) found no matching published library - this is
 * bespoke `jui-chart` widget code, same "hand-port, not vendor" bucket as every other Phase E file
 * (per PORT_STATUS.md's Phase E policy: "is the code recognizably lifted from an existing
 * published library", not "does it look generic").
 *
 * **Extend chain, confirmed from source**: `chart.widget.polygon.rotate3d` extends
 * `chart.widget.polygon.core` (a two-line pass-through: an empty `drawAfter()` override, nothing
 * else) extends `chart.widget.core` (`getIndexArray`/`getScaleToValue`/`getValueToScale`/`on()`/
 * default `drawAfter()`) extends `chart.draw`. `rotate3d.js` itself only ever uses `chart.widget.
 * core`'s `this.on(type, callback, axisIndex)` (an `axis.*`-event-scoped subscribe wrapper) - it
 * doesn't touch `getScaleToValue`/`getValueToScale`/`polygon.core`'s `drawAfter` at all.
 *
 * **Confirmed: this IS the generic, reusable drag-to-rotate interaction every polygon-based 3D
 * brush (`dot3d.js`/`column3d.js`/`line3d.js`) is meant to opt into**, not a per-brush ad-hoc
 * control - `draw()` just wires up `self.chart.axis(axisIndex)` for each configured `widget.axis`
 * index (default `[0]`) via `setScrollEvent()`; nothing in it is dot/column/line-specific. Reading
 * `PORT_STATUS.md`'s own dot3d.js/column3d.js/line3d.js entries confirms each porting agent had to
 * wire ad-hoc "Rotate X/Y/Z +15deg" demo buttons themselves because this exact widget - the real
 * mouse-drag control the source engine expects any of them to use - hadn't been ported yet.
 *
 * **Interaction model, confirmed from a full read of `setScrollEvent()`**:
 *  - Listens for `axis.mousedown` (captures `mouseStartX/Y = e.chartX/Y` and the axis's CURRENT
 *    `degree.x/y` as `sdx`/`sdy`), `axis.mousemove` (live-updates while dragging), and THREE
 *    separate mouseup sources - `axis.mouseup`/`bg.mouseup`/`chart.mouseup` - to finalize (the
 *    same "redundant mouseup listeners so a drag release outside the tracked element still
 *    resolves" shape this port's own `zoomable`/`scrollWindow` drags in `LineChart.vue` already
 *    established a `window`-level-mouseup equivalent for). Purely mouse-driven - no click,
 *    keyboard, or wheel handling anywhere in this file.
 *  - `mousemove` computes `dx = sdx + floor((gapY/h) * 180)`, `dy = sdy - floor((gapX/w) * 180)`
 *    (`gapX/Y` = live pointer delta since mousedown, `w`/`h` = `axis.area("width"/"height")` - the
 *    PLOT area, not the whole chart canvas; `180` is a hardcoded `DEGREE_LIMIT` - a full vertical
 *    drag across the plot area maps to a full 180-degree spin). Vertical drag -> X-axis rotation,
 *    horizontal drag -> Y-axis rotation (`gapX` SUBTRACTED, so dragging right rotates degree.y
 *    negative - ported exactly, not re-signed). **Z is never touched by this widget** - confirmed,
 *    `mousemove` only ever reads/writes `degree.x`/`degree.y`; a chart's `degree.z` has no mouse
 *    widget in `jui-chart` at all, ad-hoc buttons remain the only way to drive it in this port too.
 *  - A real, preserved throttle quirk: `if(dx % unit != 0 && dy % unit != 0) return` - this skips
 *    the tick only when NEITHER new angle lands on a `unit`-multiple boundary (default `unit: 5`),
 *    not "unless BOTH do" - ported faithfully as `shouldSkipRotate3dTick` below (verified with a
 *    standalone Node repro of several drag deltas - see `useRotate3d.spec.ts`).
 *  - **Mutates `axis.degree.x/y` via `axis.set("degree", {x,y})`** - i.e. it writes into the SAME
 *    `axis.degree` state `chart.polygon.core`'s `PolygonCore.rotate(depth, degree, cx, cy, cz)`
 *    reads on every draw (see `usePolygon3d.ts`'s `rotatePolygonVertices`, which takes this exact
 *    `degree` shape as a parameter) - fully covered by the already-ported `usePolygon3d.ts` engine
 *    and the `degreeX`/`degreeY` props every one of `Dot3DChart.vue`/`Column3DChart.vue`/
 *    `Line3DChart.vue` already exposes. No new engine/axis infrastructure needed.
 *  - **Redraws itself, does NOT expect the host to redraw**: immediately after `axis.set("degree",
 *    ...)`, `mousemove` calls `self.chart.render()` directly, every tick a new degree is accepted -
 *    confirmed, not left to some separate host-triggered re-render. This Vue port's equivalent is
 *    Vue's own reactivity: `degreeX`/`degreeY` are plain refs bound straight into a chart
 *    component's `degree-x`/`degree-y` props, so assigning a new value re-renders that component
 *    on the next tick automatically - no explicit `chart.render()`-equivalent call is needed or
 *    written here, the same "Vue reactivity replaces an imperative render() call" simplification
 *    this port's other widgets (`useZoomScroll.ts`/`useScrollWindow.ts`) already made.
 *
 * **Deliberate simplification over source's `widget.axis` array**: source lets one widget instance
 * drive several `chart.axis` instances at once (`widget.axis` defaults to `[0]` but accepts an
 * array of indexes, each independently tracked via its own closured `setScrollEvent(axisIndex)`
 * call). This Vue port has exactly one x/y axis pair per chart component (no multi-axis-instance
 * concept), so `useRotate3dDrag` below only ever drives one `{degreeX, degreeY}` pair - the
 * single-axis case of the original, not a behavior change.
 *
 * **Vue integration decision** (see PORT_STATUS.md's rotate3d.js entry for the full writeup): a
 * shared composable, not a retrofit of each component's internal prop plumbing. `Dot3DChart.vue`/
 * `Column3DChart.vue`/`Line3DChart.vue` already accept `degreeX`/`degreeY`/`degreeZ` as plain
 * controlled props (the same "host owns the reactive state, component just reads it" shape every
 * other prop in this port uses) - there is no missing capability inside those three components to
 * retrofit. What was missing is exactly what `rotate3d.js` itself provides: the drag gesture that
 * COMPUTES new `degreeX`/`degreeY` values from a live mouse drag. So this composable owns that
 * computation + the native `mousedown`/window-`mousemove`/window-`mouseup` wiring (same pattern as
 * `LineChart.vue`'s `onZoomDragStart`/`onScrollDragStart` families) and hands back reactive
 * `degreeX`/`degreeY` refs a page binds straight into `:degree-x`/`:degree-y` - see
 * `Dot3DPage.vue`/`Column3DPage.vue`/`Line3DPage.vue`, all three retrofitted to wire a real drag
 * over their chart alongside (not instead of) their existing ad-hoc "+15deg" buttons (Z has no
 * drag widget in source either, so those buttons remain the only Z control - removing them would
 * be a regression, not a cleanup).
 */

export const ROTATE3D_DEGREE_LIMIT = 180

export interface Rotate3dDegree {
  x: number
  y: number
}

/**
 * Ported from `mousemove()`'s degree derivation: `dx = sdx + floor((gapY/h) * 180)`,
 * `dy = sdy - floor((gapX/w) * 180)`. `gapX`/`gapY` are the live pointer delta since the drag
 * started (in the SAME pixel space `areaWidth`/`areaHeight` are measured in); `start` is the
 * degree captured at `mousedown` (source's `sdx`/`sdy`).
 */
export function computeRotate3dDegree(start: Rotate3dDegree, gapX: number, gapY: number, areaWidth: number, areaHeight: number): Rotate3dDegree {
  return {
    x: start.x + Math.floor((gapY / areaHeight) * ROTATE3D_DEGREE_LIMIT),
    y: start.y - Math.floor((gapX / areaWidth) * ROTATE3D_DEGREE_LIMIT),
  }
}

/**
 * Ported from `mousemove()`'s own render-skip guard: `if(dx % unit != 0 && dy % unit != 0)
 * return` - skips only when NEITHER new angle is a multiple of `unit` (default `5`). A real,
 * preserved throttle quirk (not "skip unless both match") - see this file's header comment.
 */
export function shouldSkipRotate3dTick(degree: Rotate3dDegree, unit: number): boolean {
  return degree.x % unit !== 0 && degree.y % unit !== 0
}

export interface UseRotate3dDragOptions {
  /** The dragged element (chart root) - used only to convert `clientX/Y` into this chart's own
   *  coordinate space via `toSvgPoint` (already-established CSS-scaling-aware conversion, shared
   *  with `LineChart.vue`'s own drag widgets - works for an `<svg>` OR a `<canvas>` root alike,
   *  since it only needs a `getBoundingClientRect()` + the component's own declared width/height). */
  elRef: ReadonlyRefLike<Element | null>
  /** Plot area width/height (source's `axis.area("width"/"height")`) - the denominator `gapX`/`gapY` are normalized against. */
  areaWidth: ReadonlyRefLike<number>
  areaHeight: ReadonlyRefLike<number>
  /** This chart component's own declared `width`/`height` prop (the coordinate space `elRef`'s `getBoundingClientRect()` is scaled into via `toSvgPoint`). */
  totalWidth: ReadonlyRefLike<number>
  totalHeight: ReadonlyRefLike<number>
  /** Minimum degree increment before a tick is applied (source's `widget.unit`, default `5`). */
  unit?: number
}

export interface UseRotate3dDrag {
  degreeX: Ref<number>
  degreeY: Ref<number>
  isDragging: Ref<boolean>
  onMouseDown: (e: MouseEvent) => void
  reset: () => void
}

/**
 * The Vue-side `setScrollEvent()` equivalent: owns `degreeX`/`degreeY` as reactive state a caller
 * binds into a chart's `degree-x`/`degree-y` props, updated live from a native mouse drag over
 * `elRef`. Unlike source (which nudges an EXISTING `axis.degree` via `axis.set()`), this composable
 * itself is the state's owner - the same "controlled reactive ref replaces an imperative mutate +
 * render() call" shape every other Phase E/widget port in this codebase already uses.
 */
export function useRotate3dDrag(options: UseRotate3dDragOptions): UseRotate3dDrag {
  const unit = options.unit ?? 5
  const degreeX = ref(0)
  const degreeY = ref(0)
  const isDragging = ref(false)

  let startPoint = { x: 0, y: 0 }
  let startDegree: Rotate3dDegree = { x: 0, y: 0 }

  function localPoint(e: MouseEvent): { x: number; y: number } {
    const el = options.elRef.value
    if (!el) return { x: e.clientX, y: e.clientY }
    const rect = el.getBoundingClientRect()
    return toSvgPoint(e.clientX, e.clientY, rect, options.totalWidth.value, options.totalHeight.value)
  }

  function onMouseDown(e: MouseEvent): void {
    if (isDragging.value) return
    isDragging.value = true
    startPoint = localPoint(e)
    startDegree = { x: degreeX.value, y: degreeY.value }
    window.addEventListener('mousemove', onWindowMouseMove)
    window.addEventListener('mouseup', onWindowMouseUp)
  }

  function onWindowMouseMove(e: MouseEvent): void {
    if (!isDragging.value) return
    const p = localPoint(e)
    const gapX = p.x - startPoint.x
    const gapY = p.y - startPoint.y
    const next = computeRotate3dDegree(startDegree, gapX, gapY, options.areaWidth.value, options.areaHeight.value)

    // Preserved throttle quirk (see header comment). Note: unlike source's own `cacheXY` string-
    // dedup (guarding against calling `chart.render()` again for an unchanged degree), no
    // equivalent guard is needed here beyond this - Vue's `ref` setter already no-ops an
    // assignment of an unchanged primitive value (`Object.is` comparison), which is the same
    // "don't re-render for an identical value" effect `cacheXY` achieves in source.
    if (shouldSkipRotate3dTick(next, unit)) return

    degreeX.value = next.x
    degreeY.value = next.y
  }

  function onWindowMouseUp(): void {
    if (!isDragging.value) return
    isDragging.value = false
    window.removeEventListener('mousemove', onWindowMouseMove)
    window.removeEventListener('mouseup', onWindowMouseUp)
  }

  function reset(): void {
    degreeX.value = 0
    degreeY.value = 0
  }

  onBeforeUnmount(() => {
    window.removeEventListener('mousemove', onWindowMouseMove)
    window.removeEventListener('mouseup', onWindowMouseUp)
  })

  return { degreeX, degreeY, isDragging, onMouseDown, reset }
}
