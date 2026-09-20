/**
 * Pure logic for `LineChart.vue`'s opt-in `zoomable` prop, ported from `widget/zoom.js` (296
 * lines), `chart.widget.zoom` (`extend: "chart.widget.core"`, confirmed from source - same chain
 * as `topologyctrl.js`/`guideline.js`/`cross.js`). Read in full, alongside `zoomscroll.js` (294)
 * and `zoomselect.js` (220), before writing anything here - see PORT_STATUS.md's `zoom.js` entry
 * for the full three-way comparison; this file only covers `zoom.js` itself.
 *
 * **Confirmed REAL (not transform-based) zoom**, unlike `topologyctrl.js`'s pan/zoom (a pure
 * `scale()`/`translate()` viewport transform over already-rendered marks - see
 * `useTopologyZoom.ts`'s header comment): `zoom.js`'s drag-rectangle gesture calls
 * `axis.zoom(start, end)` on a "block" (category) x axis, which - traced into
 * `juijs-graph/src/base/axis.js`'s `setZoom()` - does `self.data = self.origin.slice(start, end)`
 * and re-renders; every grid's own domain (`grid/block.js`'s `initDomain()`, `grid/range.js`'s
 * `initDomain()`) is confirmed (via `grid/core.js`'s `this.data()` helper, which reads
 * `this.axis.data`, NOT `this.axis.origin`) to fold over that same windowed `axis.data` array, not
 * the original full dataset - so a real zoom narrows BOTH axes' domains (x's category list AND
 * any "range" axis's min/max), not just the visible window. This port's `useAxis`/`useChartLayout`
 * already take a reactive `data: Ref<DataRow[]>` and recompute both axes' domains from it on every
 * change - so the ENTIRE mechanism ports as "slice `props.data` by row index, feed the slice into
 * the same `useChartLayout()`/`useSeries()` calls `LineChart.vue` already makes", with zero changes
 * needed to either composable. No new axis/scale primitive was needed for this.
 *
 * **Scope decision, confirmed from source before writing anything**: `zoom.js`'s drag handler only
 * ever does something for a "block" x-axis (`updateBlockGrid()`) or a "date"/"dateblock" x-axis
 * (`updateDateObj()`, gated on `startDate != null`, which is only ever set when `xtype == "date" ||
 * "dateblock"`) - for any other x type (including a plain numeric "range" x-axis) the drag
 * completes with `args = []` and no axis mutation at all, a confirmed no-op even upstream. This
 * port's `AxisConfig['type']` is only ever `'block' | 'range'` (no `date`/`dateblock` axis kind
 * exists anywhere in this port - confirmed via `types.ts`/`useAxis.ts`, same conclusion
 * `focus.js`'s/`cross.js`'s own PORT_STATUS.md entries already reached), so only the "block" branch
 * applies here; `zoomable` is a no-op (silently, matching upstream's own silent no-op) when
 * `axisX.type !== 'block'`.
 *
 * **The reset ("×") icon**: ported from `drawSection()`'s `bg` group (visible only once a zoom has
 * completed) and `rollbackZoom()` (`axis.screen(1)` for a "block" axis - shows page 1, i.e. the
 * WHOLE `origin` array again, since this port has no pagination/`buffer` concept at all - "reset"
 * is simply "show the full `data` prop again", i.e. clearing the zoom window back to `null`).
 */

export interface ZoomWindow {
  start: number
  end: number
}

/**
 * Ported from `updateBlockGrid()`: converts a completed drag-rectangle's pixel extent - in the
 * SAME absolute plot-area pixel space as `PlotArea.x`/`x2` (this port's coordinates are already
 * absolute/padding-inclusive, see `useChartLayout.ts`) - into a new `[start, end)` row-index
 * window over the ORIGINAL (un-windowed) data, offset by `currentStart` (source's `axis.start`) so
 * a second drag-zoom on an already-zoomed view composes onto it instead of resetting to the full
 * dataset first. `visibleRowCount` is the length of the data array CURRENTLY driving the axis
 * (source's `axis.data.length` - i.e. this port's already-windowed slice, not the original
 * dataset) - source computes `tick` from `axis.end - axis.start` when positive, falling back to
 * `axis.data.length` otherwise, but those two are always exactly equal once any zoom has run (both
 * updated together by `setZoom()`), so this simplifies to the one formula both branches agree on.
 *
 * Returns the RAW (possibly out-of-bounds - e.g. `end` past the original dataset's length, if the
 * drag ran past the plot area's right edge) start/end pair, matching `updateBlockGrid()`'s own
 * un-clamped output - `clampZoomWindow` below replicates the clamping `axis.zoom()` itself applies
 * (via `setZoom()`), as a separate step, same source-file split.
 */
export function computeDragZoomWindow(areaX: number, areaWidth: number, visibleRowCount: number, currentStart: number, dragX1: number, dragX2: number): ZoomWindow {
  const tick = visibleRowCount > 0 ? areaWidth / visibleRowCount : 0
  const lo = Math.min(dragX1, dragX2) - areaX
  const hi = Math.max(dragX1, dragX2) - areaX
  const start = tick > 0 ? Math.floor(lo / tick) + currentStart : currentStart
  const end = tick > 0 ? Math.ceil(hi / tick) + currentStart : currentStart
  return { start, end }
}

/**
 * Ported from `axis.zoom(start, end)`'s own `setZoom()`: clamps `start`/`end` against the
 * ORIGINAL (un-windowed) data length (`axis.origin`, not `axis.data`) and rejects a degenerate
 * (empty or reversed) window - source's own `zoom()` guards `start == end` before calling
 * `setZoom()` at all; this additionally rejects `start > end` (source's caller,
 * `updateBlockGrid()`'s own `if (start < end)` guard, already prevents that pre-clamp case in
 * practice, but a post-clamp reversal is possible in principle if a drag starts past the right
 * edge, so this stays a `>=` check for safety). Returns `null` for a degenerate window (a no-op
 * drag - e.g. a click with no movement) instead of applying anything, same as source silently
 * doing nothing when `thumbWidth == 0`.
 */
export function clampZoomWindow(window: ZoomWindow, originLength: number): ZoomWindow | null {
  const start = Math.max(0, window.start)
  const end = Math.min(window.end, originLength)
  if (start >= end) return null
  return { start, end }
}
