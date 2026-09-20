/**
 * Pure logic for `LineChart.vue`'s opt-in `zoomScrollable` prop, ported from `widget/zoomscroll.js`
 * (294 lines - read in full before writing anything, per this port's established rigor for
 * drag-interaction widgets; this is the second read, after the earlier `zoom.js`/`scroll.js`/
 * `vscroll.js` iterations already analyzed it once each - see PORT_STATUS.md's `zoom.js` and
 * `scroll.js`/`vscroll.js` entries for that groundwork). `chart.widget.zoomscroll`, `extend:
 * "chart.widget.core"` - same chain as every other Phase D widget.
 *
 * **Three genuinely distinct interactions, confirmed from `setDragEvent()`/`dragZoomAction()`, not
 * assumed**: a persistent horizontal scrollbar-like track below the chart with two independently
 * draggable EDGE HANDLES (`l_ctrl`/`r_ctrl`) that RESIZE the visible window from one side (the
 * other bound stays fixed), plus a draggable CENTER PANE (`c_rect`, `isCenter` branch) that PANS a
 * FIXED-WIDTH window - structurally the exact same fixed-width-pan math `scroll.js`'s
 * `computeScrollStart` already implements (confirmed in that item's own PORT_STATUS.md entry), just
 * reached via a variable-width (user-resized) pane instead of a fixed `visibleCount`. On
 * `mouseup`/`endZoomAction()`, all three converge on the IDENTICAL `axis.zoom(start, end)` call
 * `zoom.js`'s own entry already traced into `setZoom()`/`grid/core.js`'s `this.data()` - a REAL
 * domain-rescaling zoom (both axes' domains re-derive from the narrower slice), not a transform -
 * so this reuses `useZoomWindow.ts`'s `clampZoomWindow` (which already clamps against
 * `originLength` exactly like `zoomscroll.js`'s own `count = axis.origin.length`, confirmed in
 * `zoom.js`'s own PORT_STATUS.md entry) as the final commit step, exactly as anticipated.
 *
 * **Live-chrome-vs-committed-window split, confirmed from source, NOT invented for this port**:
 * `dragZoomAction()` (every `mousemove` tick) only redraws the widget's own SVG rects/handles and
 * updates local `start`/`end` tracking variables - it never calls `axis.zoom()` itself. Only
 * `endZoomAction()` (`mouseup`) applies the accumulated `start`/`end` to the axis and re-renders.
 * So, like `zoomable`'s drag-thumb (`zoomThumb` in `LineChart.vue`), only the widget's own chrome
 * needs to update on every tick - `windowedData`/the full chart only needs to recompute ONCE, on
 * release. This is simpler than `scrollable`'s pattern (which DOES commit `scrollStart` live, since
 * `scroll.js`'s own `mousemove()` calls `axis.zoom()` on every tick) - `zoomscroll.js` is closer to
 * `zoom.js`'s/`dragselect.js`'s "resolve only on release" shape than to `scroll.js`'s "continuous
 * commit" one, despite superficially looking like a scrollbar.
 *
 * **Edge-resize math, confirmed from source, not assumed**: dragging the LEFT handle keeps `end`
 * FIXED and recomputes `start = Math.floor(tw / tick)` from the handle's new pixel width `tw`
 * (`bgWidth + dis`, `bgWidth` captured once at `mousedown`, `dis` the CUMULATIVE `clientX` delta
 * since `mousedown` - not a per-tick incremental delta); dragging the RIGHT handle keeps `start`
 * FIXED and recomputes `end = count - Math.floor(tw / tick)` from its own new pixel width
 * (`bgWidth - dis`). Both are gated by `preventDragAction()`, which blocks the handles from
 * crossing (checked against the OTHER (undragged) side's current width, with a `tick / 2` slop) -
 * **but only in the "closing" direction** (`dis > 0` for the left handle, `dis < 0` for the right):
 * dragging back the other way always works, since `tw` is always `mousedown-width + dis`
 * (cumulative from a FIXED anchor, not incremental), so it naturally un-crosses once the pointer
 * moves back. **Deliberate simplification, not a behavior change**: rather than porting
 * `preventDragAction()`'s literal "read back last-rendered DOM width, reject the whole tick
 * (freeze) if crossing" mechanism (this port has no equivalent "last-rendered geometry" memory to
 * read back from outside an explicit ref), `computeLeftEdgeWidth`/`computeRightEdgeWidth` below
 * HARD-CLAMP `tw` to the same crossing boundary instead. Since `tw` is deterministic from the fixed
 * `dis`-anchor each tick (not path-dependent), a clamp and a freeze-at-the-boundary converge to the
 * exact same rendered value once the boundary is first reached, and both un-clamp identically once
 * the pointer moves back past it - verified equivalent by hand-tracing both against the same drag
 * sequence in `useZoomScroll.spec.ts`.
 *
 * **Center-pane math, confirmed from source**: `isCenter` captures the pane's CURRENT fixed pixel
 * width (`bgWidth = ctrl.size().width`) and left edge (`centerStart = l_rect.size().width`) once at
 * `mousedown`; every tick, the new left edge `tw = centerStart + dis` is applied ONLY if
 * `tw > 0 && tw + bgWidth < w` (both edges stay in-bounds) - a reject-the-whole-tick (freeze) guard,
 * same shape as the edge handles'. Ported the same way: `computeCenterPanLeftWidth` below clamps
 * `tw` into `[0, trackWidth - centerWidth]` instead of rejecting - equivalent end behavior (source's
 * own strict `>`/`<` reject converges to "stuck at the boundary" too, since - like the edge handles
 * - `tw` is deterministic from a fixed anchor each tick, not path-dependent). `start`/`end` both
 * shift by the SAME delta (`val = Math.floor(tw / tick) - start`, added to both) - a genuine
 * fixed-WIDTH pan, confirmed identical in shape to `scroll.js`'s own thumb-drag math (see
 * `useScrollWindow.ts`'s header comment for that file's own confirmation of this exact relationship)
 * - `computeCenterPanStart` below is deliberately NOT a call-through to `computeScrollStart` despite
 * that kinship: `computeScrollStart` bakes in a `bufferCount`/`visibleCount`-ratio thumb-size fudge
 * (`+2px`) and a `+1` edge-page correction specific to `scroll.js`'s OWN fixed-ratio thumb sizing -
 * neither applies here, where the pane's width is whatever the user's own two edge-drags left it at,
 * not a `visibleCount`-derived ratio.
 *
 * **The embedded thumbnail (`createChartImage()`), read in full again this iteration**: builds a
 * WHOLE SEPARATE `chart.builder()` instance over `axis.origin` (the FULL, un-windowed dataset - NOT
 * the currently zoomed/windowed one) for a SINGLE target (`widget.key`), serializes it to a
 * `data:image/svg+xml;utf8,...` string, and renders it as an `<image>` sized exactly to the widget's
 * own track (`w`×`h`) BEHIND the resize/pan chrome - a small always-visible preview of the FULL
 * data's shape, so the visible-window boundary can be judged against the overall trend, not just
 * bare index ticks. Its own x-axis is shown (small font, forced `hide:false, line:"solid"` even if
 * the host chart's x-axis config hides/dashes its own); its y-axis is forced hidden
 * (`hide:true, line:false`) since the track is too short for a meaningful y scale. **Confirmed
 * genuinely load-bearing for usability, not merely decorative**: without it, the resize/pan chrome
 * has ZERO visual reference to the data's own shape - a user dragging an edge handle would be
 * narrowing/panning a window blind, with no way to see "where the interesting part of the full
 * dataset is" before or during the drag (unlike `zoomable`'s live thumb, which at least previews
 * against the ALREADY-VISIBLE chart underneath it - `zoomscroll` has no such chart to preview
 * against, since it's designed to sit as a persistent control strip BELOW a chart that may itself
 * already be a narrow zoomed/scrolled view). This is why this port builds it as a REAL nested small
 * chart component (`LineChart.vue`'s own template nests a small `AreaChart`/`LineChart`, sized to
 * the track, `pointer-events: none`, showing `props.data` - the full unwindowed prop - never
 * `windowedData`) rather than skipping it or replicating source's own SVG-to-`<image>`-data-URI
 * serialization trick (this port has no `chart.builder()`-equivalent "build and serialize a whole
 * separate chart" mechanism, and inventing one just to produce an `<image>` would be MORE work, not
 * less, than nesting a real Vue chart component directly - SVG natively supports a nested `<svg>`
 * viewport, so this is not a hack). This needed one small, genuinely additive infrastructure change:
 * `AxisConfig` gained a `hide?: boolean` field (see `types.ts`), resolved in `useAxis.ts` and gated
 * in `ChartBase.vue`, since no existing demo needed to suppress an axis's chrome before this.
 *
 * All pixel math below is in the SAME absolute, padding-inclusive space as `PlotArea.x`/`x2` (see
 * `useChartLayout.ts`) - `trackWidth` is `area.x2 - area.x` (minus the widget's own
 * `zoomScrollAreaBorderWidth * 2`, matching source's own `w = this.chart.area("width") - b*2`).
 */

export interface ZoomScrollWindow {
  start: number
  end: number
}

/** Ported from `drawBefore()`'s `tick = w / count` (`count = axis.origin.length`, the FULL
 * un-windowed row count - not the currently windowed length). */
export function computeZoomScrollTick(trackWidth: number, count: number): number {
  return count > 0 ? trackWidth / count : 0
}

/** Ported from `draw()`'s `lw = start * tick; rw = (count - end) * tick` - the resting (not
 * currently dragged) left/right dimmed-region pixel widths, derived from the currently committed
 * `[start, end)` row window. */
export function computeZoomScrollRestingWidths(start: number, end: number, count: number, tick: number): { leftWidth: number; rightWidth: number } {
  return { leftWidth: start * tick, rightWidth: (count - end) * tick }
}

/**
 * Ported from `dragZoomAction()`'s `isLeft` branch: `tw = bgWidth + dis` (`bgWidth` the left
 * region's width captured at `mousedown`, `dis` the cumulative pointer delta since), hard-clamped to
 * `[0, trackWidth - rightWidth - tick / 2]` - see this file's header comment for why a clamp,
 * not source's own reject-and-freeze, is used (equivalent rendered result either way).
 */
export function computeLeftEdgeWidth(initialWidth: number, dis: number, rightWidth: number, tick: number, trackWidth: number): number {
  const tw = initialWidth + dis
  const maxWidth = trackWidth - rightWidth - tick / 2
  return Math.max(0, Math.min(tw, maxWidth))
}

/** Ported from `dragZoomAction()`'s `!isLeft` branch: `tw = bgWidth - dis`, hard-clamped to
 * `[0, trackWidth - leftWidth - tick / 2]`. See `computeLeftEdgeWidth`'s doc comment. */
export function computeRightEdgeWidth(initialWidth: number, dis: number, leftWidth: number, tick: number, trackWidth: number): number {
  const tw = initialWidth - dis
  const maxWidth = trackWidth - leftWidth - tick / 2
  return Math.max(0, Math.min(tw, maxWidth))
}

/** Ported from `dragZoomAction()`'s `isCenter` branch: `tw = centerStart + dis`, hard-clamped to
 * `[0, trackWidth - centerWidth]` (the pane's own fixed pixel width, captured at `mousedown`, never
 * changes during a center-pane drag - a pure pan). See this file's header comment for the
 * clamp-vs-reject equivalence. */
export function computeCenterPanLeftWidth(initialLeftWidth: number, dis: number, centerWidth: number, trackWidth: number): number {
  const tw = initialLeftWidth + dis
  return Math.max(0, Math.min(tw, trackWidth - centerWidth))
}

/** Ported from `dragZoomAction()`'s `val = Math.floor(tw / tick) - start` (`start`/`end` both
 * shift by `val`, so only the new `start` needs computing - `end` is `start + (windowWidth)`,
 * `windowWidth` fixed for the whole drag). */
export function computeCenterPanStart(clampedLeftWidth: number, tick: number): number {
  return tick > 0 ? Math.floor(clampedLeftWidth / tick) : 0
}

/** Resolves a completed left-edge-handle drag into a new `[start, end)` window: `start` recomputed
 * from the handle's final clamped pixel width, `end` held at whatever was committed before this
 * drag (only the left edge moved). Un-clamped against `originLength` - the caller (`LineChart.vue`)
 * runs this through `useZoomWindow.ts`'s `clampZoomWindow` next, same as `zoomable`'s own commit
 * step. */
export function resolveLeftEdgeWindow(finalWidth: number, tick: number, currentEnd: number): ZoomScrollWindow {
  return { start: tick > 0 ? Math.floor(finalWidth / tick) : 0, end: currentEnd }
}

/** Resolves a completed right-edge-handle drag: `end` recomputed from the handle's final clamped
 * pixel width, `start` held fixed. */
export function resolveRightEdgeWindow(finalWidth: number, tick: number, count: number, currentStart: number): ZoomScrollWindow {
  return { start: currentStart, end: tick > 0 ? count - Math.floor(finalWidth / tick) : count }
}

/** Resolves a completed center-pane drag: both `start`/`end` shift by the same delta (a fixed-width
 * pan), derived from the pane's final clamped left-edge pixel position. */
export function resolveCenterPanWindow(finalLeftWidth: number, tick: number, currentStart: number, currentEnd: number): ZoomScrollWindow {
  const start = computeCenterPanStart(finalLeftWidth, tick)
  return { start, end: start + (currentEnd - currentStart) }
}

/**
 * Clamps a corner radius to half of whichever of width/height is smaller, so a rounded-rect corner
 * (drawn via `useSeries.ts`'s existing `roundedRectPath()` - reused here rather than duplicated;
 * this port already has one shared rounded-rect-with-4-independent-corner-radii path helper,
 * originally built for `RateBarChart.vue`/`BarChart.vue`'s own rounded segments, ported from
 * `svg.pathRect().round()`) never overshoots the rect it's drawn on. Needed specifically for
 * `zoomscroll`'s own left/right dimmed-zone rects (`l_rect`/`r_rect`) - unlike `BarChart`'s bars,
 * these can legitimately shrink to just a few pixels wide near either edge of the track while a
 * window is being dragged, where an un-clamped `zoomScrollAreaBorderRadius` (3px) could exceed half
 * the rect's own width. `roundedRectPath()` itself is left unclamped (no existing `BarChart`/
 * `RateBarChart` caller needs it, and changing its shared numeric output isn't worth risking an
 * unrelated, already-Playwright-verified regression for a case this port's own demos never hit).
 */
export function clampCornerRadius(radius: number, width: number, height: number): number {
  return Math.max(0, Math.min(radius, width / 2, height / 2))
}
