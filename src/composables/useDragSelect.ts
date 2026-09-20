/**
 * Pure logic for `LineChart.vue`'s opt-in `dragSelect` prop, ported from `widget/dragselect.js`
 * (237 lines), `chart.widget.dragselect` (`extend: "chart.widget.core"`, confirmed from source -
 * same chain as `topologyctrl.js`/`guideline.js`/`cross.js`/`zoom.js`).
 *
 * **Confirmed interaction model, read in full before writing anything**: `dragselect.js` drags a
 * rectangle over the plot area (`axis.mousedown`/`axis.mousemove`/`axis.mouseup`, with
 * `chart.mouseup`/`bg.mouseup` as redundant fallbacks - the same "finalize from multiple mouseup
 * sources" shape `zoom.js`'s own entry already flagged) and, on release, does ONE of two things
 * depending on its own `dataType` setup option:
 *  - `"list"` (the default): walks every row of `axis.data` and, for each of `brush.target`'s keys,
 *    tests whether that (row, key) pair's value falls inside the dragged rectangle - but ONLY for
 *    an axis-type pairing of one `"date"`/`"block"` axis (the discrete axis, compared by ROW INDEX
 *    or date) crossed with one `"range"` axis (the continuous axis, compared by VALUE); any other
 *    pairing (confirmed from `emitDataList()`'s source: neither `if` branch matches) silently
 *    selects nothing. Emits `"dragselect.end"` with the array of matches
 *    (`{brush, dataIndex, dataKey, data}` each).
 *  - `"area"`: skips the per-point search entirely and just emits `"dragselect.end"` with the
 *    dragged rectangle's own two corners, each run through `axis.x.invert()`/`axis.y.invert()` - a
 *    passive "here's the range you dragged" notification with no per-point matching at all.
 *
 * Draws a live rubber-band rect (`thumb`, themed via `dragSelect{Border,Background}*`) while
 * dragging, cleared on release either way - purely a visual aid, with no chart-mutating effect of
 * its own anywhere (never calls `axis.zoom()`/`axis.updateGrid()`/`chart.render()`, confirmed via a
 * full read) - genuinely different from `zoom.js`'s drag, which rewrites both axes' real domains.
 *
 * **Confirmed genuinely distinct from what's already built** (per this item's own task brief - not
 * assumed, and not another `zoomselect.js`-style near-redundancy call): `FocusChart`'s
 * `selectEvent` is a 2-click DISCRETE-CELL picker (one rectangle snapped to axis cell boundaries,
 * emitted as a single `{start,end}` pair - see `focus.js`'s own PORT_STATUS.md entry); `zoom.js`'s
 * drag rewrites the axis's own domain (a real zoom, not a passive notification); `SelectBoxChart`
 * (`selectbox.js`) is a static per-cell hover strip with no drag gesture at all (see
 * `useSelectBox.ts`'s header comment). `dragSelect`'s `"list"` mode is the only one of these that
 * does a free-pixel drag and emits the actual matched MULTIPLE data rows themselves (not a single
 * range) - a genuinely new capability, confirmed only after reading all four sources.
 *
 * **Deliberate simplification over source's own per-axis-type value comparison**: rather than
 * porting `emitDataList()`'s four separate `date`+`range` / `range`+`date` / `block`+`range` /
 * `range`+`block` branches (this port's `AxisConfig['type']` is only ever `'block' | 'range'` - the
 * same conclusion `zoom.js`'s/`cross.js`'s/`focus.js`'s own entries already reached, so only the
 * `block`+`range`/`range`+`block` pair can ever apply here regardless), this hit-tests directly in
 * already-computed PIXEL space (`LineChart.vue`'s own per-point `x`/`y`, the exact pixels the line
 * paths/point markers themselves render from) instead of re-deriving axis values via `invert()` and
 * comparing those. Every scale this port has (`useScale.ts`) is a monotonic (order-preserving or
 * order-reversing) bijection between value and pixel space, so a point's value falls inside
 * `[startValue, endValue]` if and only if its pixel falls inside the corresponding pixel interval -
 * an equivalent, simpler, axis-type-agnostic reformulation, not a behavior change (the same kind of
 * generalization `nearestIndexByPosition()` in `useHoverGuide.ts` already made for `guideline`'s
 * snap math, for the same reason).
 */

export interface DragSelectPoint {
  x: number
  y: number
  dataIndex: number
  dataKey: string
}

export interface DragSelectMatch {
  dataIndex: number
  dataKey: string
}

/**
 * Ported from `emitDataList()`'s per-point in-rectangle test (reformulated into pixel space - see
 * this file's header comment). `x1`/`y1`/`x2`/`y2` need not be pre-sorted (mirrors source's own
 * start/end swap-if-reversed logic in `searchDataInDrag()`) - a point on the boundary is included
 * (source's own comparisons are all `>=`/`<=`, inclusive on both ends).
 */
export function pointsInDragRect(points: readonly DragSelectPoint[], x1: number, y1: number, x2: number, y2: number): DragSelectMatch[] {
  const minX = Math.min(x1, x2)
  const maxX = Math.max(x1, x2)
  const minY = Math.min(y1, y2)
  const maxY = Math.max(y1, y2)

  const out: DragSelectMatch[] = []
  for (const p of points) {
    if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) {
      out.push({ dataIndex: p.dataIndex, dataKey: p.dataKey })
    }
  }
  return out
}

export interface DragSelectRect {
  x1: number
  y1: number
  x2: number
  y2: number
}

/**
 * Ported from `searchDataInDrag()`'s own start/end swap-if-reversed logic (done here in pixel
 * space, before the caller runs each corner through `invertAxisValue()` for `dragSelectMode="area"`
 * - see `LineChart.vue`).
 */
export function normalizeDragRect(x1: number, y1: number, x2: number, y2: number): DragSelectRect {
  return { x1: Math.min(x1, x2), y1: Math.min(y1, y2), x2: Math.max(x1, x2), y2: Math.max(y1, y2) }
}

/**
 * Ported from `endZoomAction()`'s own `thumbWidth == 0 || thumbHeight == 0` guard: a drag that
 * didn't move on at least one axis (including a plain click) is degenerate and finalizes to
 * nothing - no `"dragselect.end"` emission at all, not even an empty one.
 */
export function isDegenerateDragRect(x1: number, y1: number, x2: number, y2: number): boolean {
  return x1 === x2 || y1 === y2
}
