/**
 * Pure logic for `FocusChart.vue`, ported from `focus.js` (98 lines, `extend: "chart.brush.core"`
 * directly - confirmed from source, not assumed). See `FocusChart.vue`'s header comment for the
 * full source derivation, the dependency check that cleared this for a standalone port, and the
 * one deliberate addition (click-to-select) this file also carries logic for.
 *
 * **What `focus.js` actually is, confirmed from `draw()`/`drawFocus()`**: a translucent rect with a
 * solid border line on each of its two edges, spanning the FULL plot area in the perpendicular
 * dimension, positioned between two config-driven indices (`brush.start`/`brush.end`, both `-1` by
 * default - `draw()` returns an empty `<g>` when either is `-1`). It draws NOTHING else and never
 * calls `this.addEvent(...)` anywhere - the overlay itself is not a clickable/hoverable element
 * upstream, unlike most other brush types in this port. `grid` (which axis the selection runs
 * along) is decided once, in `drawBefore()`, from `this.axis.y.type`: `"x"` when the y-axis is a
 * `"range"` (value) axis (the common vertical-chart case - selection runs along the x/category
 * axis), `"y"` otherwise (a `"block"` y-axis - the horizontal-chart case, selection runs along y).
 * This mirrors the x/y-identity-driven direction logic `useChartLayout.ts` already documents for
 * axis orientation, just gated on `axis.y.type` specifically rather than `x` vs `y` identity.
 *
 * **Dependency check (this port's Phase C process, see PORT_STATUS.md)**: `focus.js` reads only
 * `this.axis`/`this.chart`/`this.svg`/`this.brush` - all supplied by `chart.brush.core` itself, no
 * `widget/zoom.js`/`widget/zoomscroll.js`/`widget/zoomselect.js` import or call anywhere in the
 * file. No example in `jui-chart/examples/` references a `focus` brush type at all (grepped), and
 * neither `zoomselect.js` nor `dragselect.js` (the two widgets that DO implement real drag
 * gestures) ever look up a brush by type `"focus"` or write to a brush's `start`/`end` fields -
 * they draw their own separate overlay groups entirely. So `focus.js` is genuinely a passive
 * renderer, fully functional given nothing but `start`/`end` config - it just has no drag
 * interaction of its own; upstream, *something* external (typically hand-rolled app code reacting
 * to another chart's zoom/pan) is expected to set `brush.start`/`brush.end` and re-render. This
 * port adds a minimal, clearly-separate click-to-select capability (`resolveFocusSelection` below)
 * so the ported component is genuinely interactive standalone - it does not touch `focusPixelRange`
 * (the faithful `drawFocus()` port) at all.
 */

export type FocusGridAxis = 'x' | 'y'

/** Ported from `focus.js`'s `drawBefore()`: `grid = (this.axis.y.type == "range") ? "x" : "y"`. */
export function focusGridAxis(yAxisType: 'block' | 'range'): FocusGridAxis {
  return yAxisType === 'range' ? 'x' : 'y'
}

export interface FocusPixelRange {
  start: number
  end: number
}

/**
 * Ported from `focus.js`'s `draw()`: converts the two config indices into a pixel range along
 * `grid`'s axis, via that axis's own scale function. Returns `null` when either index is `-1`
 * (matching `draw()`'s early `return this.svg.g()` - nothing to render).
 *
 * For a `"block"` grid axis, the source expands the raw scale positions outward by half a
 * `rangeBand()` on each side (`scale(start) - size/2`, `scale(end) + size/2`) so the overlay
 * spans full category cells, not just their center points - ported here exactly, **including**
 * its asymmetric behavior for a reversed selection (`start` index numerically after `end` index):
 * the `-size/2`/`+size/2` are applied to whichever index is passed as `start`/`end`, not to
 * whichever pixel position ends up smaller - a faithful-to-source quirk, not a bug fixed here (the
 * source has no index-ordering guard of its own, and this port doesn't add one to this function -
 * see `FocusChart.vue`'s demo for a callout of this exact case).
 *
 * For a `"range"` grid axis, the indices are passed straight through the scale with no band
 * adjustment (`draw()`'s `else` branch) - the caller is responsible for passing values in that
 * axis's own domain units (matches upstream: `brush.start`/`brush.end` are only ever meaningful as
 * literal *indices* when paired with a `"block"` grid axis; against a `"range"` grid axis they're
 * raw domain values, despite the `@cfg` doc comment calling both "index").
 */
export function focusPixelRange(gridAxisType: 'block' | 'range', scale: (value: number) => number | null, band: number, start: number, end: number): FocusPixelRange | null {
  if (start === -1 || end === -1) return null

  // `scale` is typed nullable to accept both this port's block (`OrdinalScale`) and range
  // (`LinearScale`) scale functions directly (same convention as `useSelectBox.ts`'s
  // `selectBoxCells`) - in practice neither ever returns `null` for a valid in-range index/value,
  // the `?? 0` is just the same defensive fallback that precedent already uses.
  if (gridAxisType === 'block') {
    return { start: (scale(start) ?? 0) - band / 2, end: (scale(end) ?? 0) + band / 2 }
  }

  return { start: scale(start) ?? 0, end: scale(end) ?? 0 }
}

export interface FocusSelectionState {
  /** The first click of an in-progress 2-click selection, or `null` between selections. */
  pendingStart: number | null
  /** `-1` until a selection completes (matches `focus.js`'s own `start`/`end` "unset" sentinel). */
  start: number
  end: number
}

/**
 * **Added, not ported** - `focus.js` has no selection/interaction logic of its own (see this
 * file's header comment). A minimal 2-click range picker over discrete block-axis tick indices:
 * the first click arms `pendingStart`; the second click resolves `start`/`end` (low/high sorted,
 * so click order doesn't matter) and clears `pendingStart`, ready for a fresh selection. Clicking
 * the SAME index twice selects that single category (`start === end`).
 */
export function resolveFocusSelection(current: FocusSelectionState, clickedIndex: number): FocusSelectionState {
  if (current.pendingStart === null) {
    return { pendingStart: clickedIndex, start: current.start, end: current.end }
  }

  const start = Math.min(current.pendingStart, clickedIndex)
  const end = Math.max(current.pendingStart, clickedIndex)
  return { pendingStart: null, start, end }
}
