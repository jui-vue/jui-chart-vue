/**
 * Pure logic for `LineChart.vue`'s opt-in `scrollable`/`vScrollable` props, ported from
 * `widget/scroll.js` and `widget/vscroll.js` (125 lines each - both read in full before writing
 * anything, per this port's established rigor for drag-interaction widgets).
 *
 * **Extend chain, confirmed from source**: both `extend: "chart.widget.core"` DIRECTLY - not one
 * extending the other (unlike a hypothetical shared-base pair). They are two independent,
 * near-duplicate files: `vscroll.js` is `scroll.js` with every `x`/`width`/`bgX`/`thumbWidth`
 * swapped for `y`/`height`/`bgY`/`thumbHeight` (confirmed via a full line-by-line read of both -
 * every other line, including variable names/formulas, matches exactly) - there is no shared
 * "scroll core" module either file reaches into.
 *
 * **Interaction model, confirmed from source, not assumed**: a classic scrollbar (a fixed
 * background track + a draggable thumb), NOT a domain-rescaling zoom (`zoom.js`, a variable-size
 * drag-any-rectangle window) and NOT `topologyctrl.js`'s view-transform pan. The thumb's SIZE is
 * fixed by the ratio `axis.buffer / axis.origin.length` (`thumbWidth = trackWidth * (bufferCount /
 * dataLength) + 2`, `drawBefore()`) - `axis.buffer` (confirmed in
 * `juijs-graph/src/base/axis.js`, `@cfg buffer: 10000` - "Limits the number of elements shown on a
 * chart") is a per-axis "how many rows fit on screen at once" cap; a scrollbar only becomes
 * meaningful once `origin.length > buffer`. Dragging the thumb PANS a FIXED-SIZE window of row
 * indices (`axies[i].zoom(start, start + bufferCount)` for every axis, on every `mousemove`) - the
 * window's WIDTH never changes, only its start index - genuinely distinct from `zoom.js`'s
 * variable-size window. This port has no `buffer` axis config (`useAxis`/`useChartLayout` always
 * render the whole windowed `data` ref passed in) - `visibleCount` on `LineChart.vue` is the new,
 * explicit equivalent ("how many rows are visible in one screen"). **Deliberate simplification**:
 * the scrollbar only renders when `data.length > visibleCount` (`canScroll` below) - source instead
 * always draws a (possibly oversized, effectively undraggable) thumb even when there's nothing to
 * scroll; this port skips that dead-weight visual entirely (see PORT_STATUS.md).
 *
 * **Relationship to `zoomscroll.js` (still deferred, not ported this iteration)**: confirmed from a
 * full read of `zoomscroll.js` that this pair is a SIMPLER sibling of the exact same underlying
 * mechanism, not an unrelated widget. `zoomscroll.js`'s own `endZoomAction()` ends by calling the
 * IDENTICAL `axis.zoom(start, end)` this file's drag math feeds - just reached via a resizable
 * dual-handle range UI (`l_ctrl`/`r_ctrl`/`c_rect`, variable-width, no fixed `bufferCount`) plus an
 * embedded thumbnail-chart `<image>` (`createChartImage()`, still the real blocker - this port has
 * no "build a whole separate chart, serialize to an SVG image" mechanism, see `zoom.js`'s own
 * PORT_STATUS.md entry). This file's row-window math (`computeScrollStart`/thumb sizing) is the
 * plain, fixed-width special case of that same `axis.zoom()` endpoint - it does NOT unblock the
 * thumbnail-chart problem, but it does confirm `zoomscroll.js`'s center-pane drag (`isCenter` branch
 * in `dragZoomAction()`, which PANS a fixed-width selection exactly like this file's thumb, as
 * opposed to its two edge-handle branches, which RESIZE it) would reuse this exact
 * `computeScrollStart`-style formula once ported, and that `LineChart.vue`'s existing
 * `windowedData`/`props.data.slice(start, end)` plumbing (built for `zoom.js`, reused as-is by this
 * item) is already the right endpoint for it too.
 *
 * All formulas below are ORIENTATION-AGNOSTIC (`trackSize`/`gap` stand for width/x in `scroll.js`,
 * height/y in `vscroll.js` - confirmed identical after the s/x/y/ swap above) - `LineChart.vue`
 * calls the same functions for both the horizontal (`scrollable`) and vertical (`vScrollable`)
 * scrollbar, sharing ONE underlying row-index window (`scrollStart`): even used together upstream,
 * both widgets drive the exact same `axis.zoom()` call on the exact same chart axes, so there is
 * only ever one window to track, not two independent ones.
 */

/** Ported from `drawBefore()`'s `dataLength == 0` guard, generalized to "nothing to scroll" -
 * `visibleCount` must be a positive number smaller than `dataLength` for the scrollbar to do
 * anything (see this file's header comment for why this port additionally gates on it, unlike
 * source). */
export function canScroll(dataLength: number, visibleCount: number): boolean {
  return visibleCount > 0 && dataLength > visibleCount
}

/**
 * Ported from `drawBefore()`'s `thumbWidth`/`thumbHeight`: the thumb's size is the plain
 * visible/total ratio of the track, plus source's own `+2` px (border-straddling) fudge. Clamped to
 * the track itself so it can never render bigger than 100% - a defensive clamp source itself
 * doesn't need (its caller, `canScroll` above, already gates rendering to `visibleCount <
 * dataLength`, so this only guards `dataLength <= 0`).
 */
export function computeThumbSize(trackSize: number, visibleCount: number, dataLength: number): number {
  if (dataLength <= 0) return trackSize
  const size = trackSize * (visibleCount / dataLength) + 2
  return Math.min(size, trackSize)
}

/** Ported from `mousemove()`'s clamp: `gap < 0 -> 0`; `gap + thumbSize > trackSize -> trackSize -
 * thumbSize` (keeps the thumb fully inside the track either way). */
export function clampThumbGap(gap: number, thumbSize: number, trackSize: number): number {
  if (gap < 0) return 0
  if (gap + thumbSize > trackSize) return Math.max(trackSize - thumbSize, 0)
  return gap
}

/**
 * Ported from `mousemove()`'s `start` derivation: `startgap = gap * rate` (`rate = totalWidth /
 * trackSize = dataLength / bufferCount`), `start = floor(startgap / piece)` (`piece = trackSize /
 * bufferCount`), with a `+1` correction when the thumb is flush against the track's far edge
 * (`gap + thumbWidth == trackSize`). Algebraically, `rate / piece` collapses to `dataLength /
 * trackSize` regardless of `bufferCount` (`visibleCount` here) - `(dataLength / bufferCount) /
 * (trackSize / bufferCount) = dataLength / trackSize` - so this simplifies to `floor(gap *
 * dataLength / trackSize)`. Source's own `+1` edge correction is preserved as-is (it compensates
 * for the `+2` px thumb-size fudge otherwise rounding the very last page's floor down by one - see
 * this file's header comment's hand-traced example in `useScrollWindow.spec.ts`), then the result
 * is clamped so `start + visibleCount` never exceeds `dataLength` - source doesn't need this
 * explicit clamp (it falls out of `axis.zoom()`'s own end-clamp against `dataList.length`
 * instead); it's kept here since this function returns just `start`, consumed directly as a slice
 * index by `LineChart.vue`.
 */
export function computeScrollStart(gap: number, thumbSize: number, trackSize: number, dataLength: number, visibleCount: number): number {
  if (trackSize <= 0 || dataLength <= 0) return 0
  let start = Math.floor((gap * dataLength) / trackSize)
  if (gap + thumbSize >= trackSize) start += 1
  return Math.max(0, Math.min(start, dataLength - visibleCount))
}

/**
 * Inverse of `computeScrollStart`, for rendering the thumb's RESTING position from the currently
 * committed `start` row index. Source never needs this - `thumbLeft`/`thumbTop` is its own single
 * source of truth, continuously updated by live per-pixel drag deltas, with `start` only ever
 * DERIVED from it. This port instead treats the row-index `start` as the canonical windowing state
 * (the same shape as `zoom.js`'s own `zoomWindow` ref - see `useZoomWindow.ts`), so the thumb's rest
 * position (e.g. right after a prop change, or before any drag has happened) is derived from it
 * here instead. Not an exact round-trip of `computeScrollStart` (that function floors) - that only
 * matters for sub-pixel thumb placement, never for the row window itself, and during an active drag
 * `LineChart.vue` renders the thumb from the live per-pixel drag gap directly, not through this
 * function (matching `zoom.js`'s/`dragselect.js`'s own live-thumb-during-drag precedent).
 */
export function computeThumbGapFromStart(start: number, trackSize: number, dataLength: number, thumbSize: number): number {
  if (dataLength <= 0) return 0
  const gap = (trackSize * start) / dataLength
  return clampThumbGap(gap, thumbSize, trackSize)
}
