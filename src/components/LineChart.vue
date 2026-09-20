<script setup lang="ts">
// Ported from `chart.brush.line`: one <path> per contiguous run of non-null values, per
// target. `symbol="curve"` uses curvePoints() (a ported Catmull-Rom-ish spline solve) for
// cubic bezier control points; `symbol="step"` inserts a mid-point jog, matching the original's
// LineTo(sx,y[start]).LineTo(sx,y[end]) step shape.
//
// `active`/`activeEvent`: ported from `setActiveEffects()` (static `active` dims non-matching
// series) and `setActiveEffect()` (the `activeEvent` DOM event highlights just the
// event-triggered line, dimming the rest) - see useActive.ts's `lineActiveOpacity()`. Unlike the
// original (whose `activeEvent` listener never resets on its own), a "mouseover"/"mouseenter"
// `activeEvent` restores full opacity on `mouseout` too, since that's the natural hover pairing;
// `"click"` toggles and has no such auto-reset, matching a click-to-pin interaction.
//
// Per-element event forwarding (`click`/`dblclick`/`contextmenu`/`mouseover`/`mouseout`), ported
// from `brush/core.js`'s `addEvent()`/`chart.emit()` - see `ChartElementEventPayload` in types.ts
// for the payload shape/deviations. `line.js`'s `drawLine()` calls `addEvent(p, null, k)` on each
// target's whole line-segment `<path>` (not per-point) - `dataIndex`/`data` are always `null` for
// this component's events, matching that; `dataKey` is the series' `target` key. Proof-of-concept
// component for this Phase A item (see PORT_STATUS.md) - `BarChart.vue` also has it (per-bar,
// with a real `dataIndex`/`data`); the rest of Phase A's components don't yet.
//
// `display: "max"|"min"|"all"`: ported from `createTooltip()`'s per-point gate
// (`(display=="max" && pos.max[i]) || (display=="min" && pos.min[i]) || display=="all"`) -
// `pos.max[i]`/`pos.min[i]` are exactly `useSeries()`'s already-computed per-point `max`/`min`
// flags (per-target, across all rows), read directly off `series` below rather than recomputed via
// `selectDisplayBars` (unlike `BarChart.vue`/`ScatterChart.vue`, which don't otherwise call
// `useSeries()` and so need that standalone helper). **Deviation**: the original's
// `createTooltip()` only ever creates *one* tooltip object per line for `"max"`/`"min"` mode
// (`tooltip == null` guards re-creation, so a tie only shows the first qualifying point) - this
// port instead shows every tied point's label, matching this codebase's established convention
// from `BarChart.vue`/`ScatterChart.vue`'s `display` (both show all ties), for consistency across
// components rather than replicating that original quirk.
//
// `stacked`: ported from `stackline.js`, source-confirmed to be a genuinely thin wrapper -
// `{ extend: "chart.brush.line", draw() { return this.drawLine(this.getStackXY()) } }`, nothing
// else (no new options, no changed defaults). Since `drawLine()` itself never references any
// other target's data (a line is just a path through its own points, no fill/band to reconcile),
// swapping the point *source* is the entire change - Phase A's `useStackedSeries` (a drop-in
// alternative to `useSeries` with the identical `ComputedRef<SeriesPoint[]>` shape) is consumed
// here exactly as its own doc comment anticipated. Implemented as a boolean prop on `LineChart`
// itself (see PORT_STATUS.md's "stacked" design-decision writeup for why this was chosen over a
// separate `StackLineChart` component) rather than a new component - both `seriesNormal`/
// `seriesStacked` computeds are kept live so toggling the prop reacts correctly.
//
// `guideline`/`crosshair`: ported from `widget/guideline.js` and `widget/cross.js`, both read in
// full before writing anything, per PORT_STATUS.md's own instruction to check their overlap
// first. **Confirmed genuinely different, not a redundant pair**: `guideline.js` SNAPS a single
// vertical line to the nearest DATA ROW (`Math.floor((time - domain[0]) / (domainRange /
// data.length))`, then `axis.x(index)`) and pairs it with a rich per-series content tooltip
// (`brush.target.forEach(...)`, one colored dot + `"key: value"` line per target, positioned via
// each target's own y at that row) - it only ever has a vertical (x-axis) line. `cross.js` tracks
// the RAW, un-snapped pointer position on EITHER/BOTH axes independently (`xline`/`yline`, each
// gated by whether `xFormat`/`yFormat` is set) and pairs each line with a single plain
// axis-value-readout balloon (`axis.x.invert(e.chartX)`/`axis.y.invert(e.chartY)`) - no per-series
// tooltip, no data-row snapping at all. Both ported, as two separate opt-in props here rather than
// as a `axis: 'x'|'y'|'both'` option on one shared prop (see PORT_STATUS.md for the full note).
//
// **Integration decision**: both are opt-in props on this existing component, matching
// `topologyctrl.js`'s precedent rather than `legend.js`'s (a genuinely separate component) -
// because both need LIVE access to this chart's own already-computed axis scale/series (`axisX`/
// `axisY`/`series` below), the same reason `topologyctrl.js`'s pan/zoom became `TopologyChart`
// props: there's no sibling chart instance (or duplicate axis/series computation) a standalone
// component could reach into without recomputing this file's own `useChartLayout()`/`useSeries()`
// call from scratch. Unlike `topologyctrl.js`, both DO draw independent visual marks (a line, a
// tooltip) - but that visual surface lives entirely WITHIN this chart's own plot area/SVG bounds
// (same overlay layer `ChartTooltip`'s hover/`display` balloons already use), not outside it like
// `legend.js`'s standalone key list - so the "independent visual real estate" half of `legend.js`'s
// own two-question test still doesn't push this toward a separate component.
//
// **Snapping/positioning, deliberately NOT a literal port**: `guideline.js`'s domain/interval
// snap math assumes a `range`-type (numeric) x axis with rows evenly spaced across it - this
// port's x axis is at least as often `block`-type (categorical), where that formula doesn't apply.
// `nearestIndexByPosition()` (`useHoverGuide.ts`) snaps directly off each row's own ALREADY-
// RENDERED x pixel (`series.value[0].x`) instead, which works identically for either axis type.
// `cross.js`'s `axis.x.invert()`/`axis.y.invert()` readout is ported as-is via `invertAxisValue()`
// (same file), with one addition: `OrdinalScale.invert()` (a `block` axis) has no upper clamp of
// its own, so `invertAxisValue()` clamps into the valid tick range before mapping back to a label.
//
// **Reused rather than re-ported**: both original widgets draw their own tooltip box/balloon from
// scratch, with their own `guidelineTooltip*`/`crossBalloon*` theme tokens. This port reuses the
// EXISTING `ChartTooltip.vue` component (already used for this file's hover/`display` tooltips)
// for both - `guideline`'s content box is a `ChartTooltip` with one `{key, value}` item per
// target; `crosshair`'s readout is a `ChartTooltip` with a single unkeyed value. Only the LINE/
// POINT-MARKER tokens are newly ported (`guidelineBorder*`/`guidelinePoint*`/`crossBorder*` in
// `useTheme.ts`) - the tooltip-box tokens are deliberately dropped as redundant with `tooltip*`,
// documented deviation for consistency with the rest of this file rather than a second, near-
// identical token set. One further simplification: the original's under-axis x-value balloon
// (`guideline.js`'s own `xTooltip`, separate from its content tooltip) is dropped - the content
// tooltip already carries every target's value at the snapped row, and the x position/category is
// already visible via the existing bottom-axis tick labels for a `block` x axis.
//
// `zoomable`: ported from `widget/zoom.js` (296 lines) - one of three zoom widgets read in full
// this iteration (`zoomscroll.js`/`zoomselect.js` - see PORT_STATUS.md's `zoom.js` entry for the
// full three-way comparison; only `zoom.js` itself is ported this iteration). **Confirmed REAL
// (domain-rescaling) zoom, not a transform** (unlike `topologyctrl.js`'s pan/zoom): drag a
// rectangle over the plot area to re-window the visible ROWS by index - traced into
// `juijs-graph`'s `axis.zoom()`/`setZoom()`/`grid/core.js`'s `this.data()`, a real zoom slices the
// underlying data array and every axis (x AND y) re-derives its domain from that slice, not just
// the visible pixel range. This port's `useChartLayout()`/`useSeries()` already take a reactive
// `data` ref and recompute both axes from it - so the entire mechanism is "feed a sliced `data`
// ref into the SAME calls this file already makes", needing no composable changes at all; only
// the pure slice/clamp math is new (`useZoomWindow.ts`). Only meaningful for a `"block"` x-axis
// (silently a no-op otherwise) - confirmed from source (`updateBlockGrid()`'s branch is the only
// one that applies; the other branch needs a `"date"`/`"dateblock"` x type, which doesn't exist
// anywhere in this port - see `useZoomWindow.ts`'s header comment). Drag thumb + reset ("×") icon
// ported from `drawSection()`/`rollbackZoom()`, reusing this file's existing hover hit-rect/
// `toSvgPoint()` plumbing rather than a second one.
//
// `dragSelect`: ported from `widget/dragselect.js` (237 lines), read in full before writing
// anything, per this item's own task brief - see `useDragSelect.ts`'s header comment for the full
// interaction-model confirmation and the "genuinely distinct from FocusChart's selectEvent/zoom.js/
// SelectBoxChart" analysis. Drags a rectangle over the plot area and, on release, either selects
// every data point whose rendered pixel falls inside it (`dragSelectMode="list"`, the default) or
// just emits the dragged rectangle's own axis-value corners with no per-point matching at all
// (`dragSelectMode="area"`) - a passive, non-domain-mutating notification either way (unlike
// `zoomable`, it never re-windows `data`). **Shares this file's existing guideline/crosshair/
// zoomable hit-rect** (same reasoning as those - live access to this chart's own `axisX`/`axisY`/
// `series`/`points` needed), but tracks its own drag state (`dragSelectStartX/Y`/
// `dragSelectCurrentX/Y`) since it's a genuinely 2-D drag (both x AND y), unlike `zoomable`'s
// 1-D (x-only) one. **Mutually exclusive with `zoomable` on the same physical drag** (both
// listen on the same mousedown) - if both props are enabled at once, `zoomable`'s drag wins
// (`onDragSelectStart` no-ops while `zoomActive` is true) since a real domain rewrite is the more
// surprising of the two to silently skip; enabling both together on one chart isn't a realistic
// combination (the demo page only ever shows one at a time), so this precedence is a documented,
// low-stakes tie-break, not a load-bearing design decision. Finalizes via the SAME `window`-level
// `mouseup` pattern `zoomable`'s own entry established (computed from the mouseup event's own
// `clientX`/`clientY`, target-independent) - reusing that fix rather than reintroducing the
// mouseleave-on-a-covered-hit-rect bug it was written to avoid.
//
// `scrollable`/`verticalScrollable`: ported from `widget/scroll.js`/`widget/vscroll.js` (125 lines each,
// both read in full before writing anything) - see `useScrollWindow.ts`'s header comment for the
// full extend-chain/interaction-model/`zoomscroll.js`-relationship writeup. A classic scrollbar
// (track + draggable thumb) that PANS a FIXED-SIZE window of `visibleCount` rows through `data` -
// genuinely distinct from `zoomable`'s variable-size drag-any-rectangle window, and from
// `topologyctrl.js`'s view-transform pan. Reuses the SAME `windowedData` slicing mechanism
// `zoomable` already established (both are just different ways to compute a `{start, end}` pair fed
// into `props.data.slice()`) - `zoomable` takes precedence when both are enabled (same documented,
// low-stakes tie-break as `dragSelect` above). The thumb drag is tracked on `window` for BOTH
// `mousemove` and `mouseup` (not just `mouseup` like `zoomable`/`dragSelect` above) - dragging a
// scrollbar thumb is a continuous, live-updating gesture in source too (`chart.mousemove`/
// `bg.mousemove` immediately call `axis.zoom()` and re-render on every tick), and the pointer
// routinely leaves the thin ~7px track strip mid-drag, so anchoring only to the thumb's own
// `mousemove` would reintroduce the exact element-relative-pointer-events bug class `zoomable`'s
// own `window`-level `mouseup` fix was written to avoid, just for `mousemove` instead of `mouseup`.
//
// `zoomScrollable`: ported from `widget/zoomscroll.js` (294 lines, read in full a second time this
// iteration - see `useZoomScroll.ts`'s header comment for the full source mapping/design writeup,
// including why this is the LAST Phase D item and the design decision behind it). A persistent
// control strip BELOW the chart with two independent edge-resize handles (narrow the window from
// one side, the other bound fixed) plus a draggable center pane (pans the fixed-width window - the
// exact same math `scrollable`'s own `computeScrollStart` established, confirmed from source),
// backed by a real embedded thumbnail chart (a small nested `AreaChart`/`LineChart`, showing the
// FULL un-windowed `data`) instead of source's own SVG-to-`<image>`-data-URI serialization trick
// (this port has no `chart.builder()`-equivalent "build and serialize a whole separate chart"
// mechanism - nesting a real small chart component is the natural, LESS work, more idiomatic Vue
// equivalent, not a shortcut - SVG natively supports a nested `<svg>` viewport). Shares the SAME
// `zoomWindow` ref `zoomable` uses (both ultimately compute a `{start, end}` row window fed into
// the identical `windowedData.slice()` - see `useZoomWindow.ts`) - `zoomable` takes precedence when
// both are enabled, same tie-break convention as `dragSelect`/`scrollable` above. Only meaningful
// for a `"block"` x-axis, same constraint/reasoning as `zoomable` (the widget's own `tick = w /
// count` geometry assumes evenly-index-spaced rows, the same assumption `zoom.js`'s own
// `computeDragZoomWindow` makes). Live drag state updates the widget's own chrome on every
// `mousemove` tick (matching source's `dragZoomAction()`, which never itself calls `axis.zoom()`);
// the actual row-window commit (and the full chart re-render that follows) happens once, on
// `mouseup` (matching source's `endZoomAction()`) - closer to `zoomable`/`dragSelect`'s
// "resolve-on-release" shape than to `scrollable`'s "commit every tick" one, despite the surface
// resemblance to a scrollbar.
import { computed, onBeforeUnmount, ref, toRef } from 'vue'
import { lineActiveOpacity } from '../composables/useActive'
import { useChartLayout } from '../composables/useChartLayout'
import { isDegenerateDragRect, normalizeDragRect, pointsInDragRect } from '../composables/useDragSelect'
import { clamp, invertAxisValue, nearestIndexByPosition, toSvgPoint } from '../composables/useHoverGuide'
import { canScroll, clampThumbGap, computeScrollStart, computeThumbGapFromStart, computeThumbSize } from '../composables/useScrollWindow'
import { curvePoints, roundedRectPath, toSeriesScale, useSeries, useStackedSeries } from '../composables/useSeries'
import { useColorResolver } from '../composables/useColorResolver'
import { useTheme } from '../composables/useTheme'
import { clampZoomWindow, computeDragZoomWindow, type ZoomWindow } from '../composables/useZoomWindow'
import {
  clampCornerRadius,
  computeCenterPanLeftWidth,
  computeLeftEdgeWidth,
  computeRightEdgeWidth,
  computeZoomScrollRestingWidths,
  computeZoomScrollTick,
  resolveCenterPanWindow,
  resolveLeftEdgeWindow,
  resolveRightEdgeWindow,
} from '../composables/useZoomScroll'
import AreaChart from './AreaChart.vue'
import ChartBase from './ChartBase.vue'
import ChartTitle from './ChartTitle.vue'
import ChartTooltip from './ChartTooltip.vue'
import type { AxisConfig, BarDisplayMode, ChartElementEventPayload, ChartElementEventType, ChartPadding, DataRow, LineSymbol, ThemeName } from '../types'

const props = withDefaults(
  defineProps<{
    data: DataRow[]
    target: string[]
    axisX: AxisConfig
    axisY: AxisConfig
    width?: number
    height?: number
    theme?: ThemeName
    padding?: Partial<ChartPadding>
    symbol?: LineSymbol
    showPoints?: boolean
    /** Stacks each target on top of the previous one (cumulative sum along the range axis),
     * instead of each plotting its own independent value. Ported from `stackline.js` (a thin
     * wrapper swapping `getXY()` for `getStackXY()` - see this file's header comment). */
    stacked?: boolean
    colors?: string[]
    opacity?: number
    showGrid?: boolean
    showTooltip?: boolean
    title?: string
    /** Highlights (full opacity) the series matching this target key or keys, dimming the rest. Ported from line.js's `active`. */
    active?: string | string[] | null
    /** DOM event name (e.g. `"click"`, `"mouseover"`) that highlights the hovered/clicked series. `null` (default) disables the interaction, per line.js's `activeEvent`. */
    activeEvent?: string | null
    /** Shows a persistent value label on the point(s) holding each target's max value, min value,
     * or on every point. Default (omitted) shows none - matches `line.js`'s `display` option
     * (default `null`). */
    display?: BarDisplayMode
    /** Formats the value shown in the hover tooltip and any `display` label. Default: the raw value. */
    format?: (value: number) => string | number
    /** Ported from `widget/guideline.js`. A vertical line SNAPPED to the nearest data row under
     * the pointer, paired with a `ChartTooltip` listing every target's value at that row (colored
     * dots mark each target's own point on the line too) - see this file's header comment for the
     * full design writeup, including why this is a prop here rather than a separate component
     * (needs live access to this chart's own scale/series, like `topologyctrl.js`'s precedent) and
     * why it reuses `props.format`/`ChartTooltip` instead of porting `xFormat`/`tooltipFormat`/a
     * second tooltip token set. */
    guideline?: boolean
    /** Ported from `widget/cross.js`. A crosshair that tracks the RAW (un-snapped) pointer
     * position - `true`/`'both'` draws both lines, `'x'`/`'y'` draws just one, each paired with a
     * `ChartTooltip` reading off that axis's inverted value at the pointer. Genuinely different
     * from `guideline` (continuous vs. snapped, single-value readout vs. full per-series tooltip) -
     * see this file's header comment for the full overlap analysis. */
    crosshair?: boolean | 'x' | 'y' | 'both'
    /** Formats the x-axis value shown in the `crosshair` vertical-line readout. Default: the raw tick label/value. */
    crosshairXFormat?: (value: string | number) => string | number
    /** Formats the y-axis value shown in the `crosshair` horizontal-line readout. Default: the raw tick label/value. */
    crosshairYFormat?: (value: string | number) => string | number
    /** Ported from `widget/zoom.js`. Drag a rectangle over the plot area to re-window the visible
     * rows by index (both axes' domains re-derive from the narrower slice - a REAL zoom, not a
     * visual transform); click the reset ("×") icon that appears after a zoom to show the full
     * `data` again. Only meaningful when `axisX.type === "block"` (silently a no-op otherwise,
     * matching upstream) - see this file's header comment for the full design writeup. */
    zoomable?: boolean
    /** Ported from `widget/dragselect.js`. Drag a rectangle over the plot area to select every
     * data point (across all `target` series) whose rendered pixel falls inside it - a passive,
     * non-domain-mutating multi-point selection, genuinely different from `zoomable`'s real
     * axis-domain rescale. Draws a live rubber-band rect while dragging, cleared on release either
     * way. Mutually exclusive with `zoomable` on the same drag (if both are enabled, `zoomable`
     * takes precedence) - see this file's header comment. */
    dragSelect?: boolean
    /** Ported from `dragselect.js`'s own `dataType` setup option (`"list"` default / `"area"`).
     * `'list'` emits the matched `{dataIndex, dataKey, data}` rows; `'area'` skips per-point
     * matching and just emits the dragged rectangle's own two corners as axis values - see this
     * file's header comment and `useDragSelect.ts`'s. */
    dragSelectMode?: 'list' | 'area'
    /** Ported from `widget/scroll.js`. A horizontal scrollbar (below the plot area by default) that
     * PANS a FIXED-SIZE window of `visibleCount` rows through `data` - distinct from `zoomable`'s
     * variable-size drag-any-rectangle zoom (see `useScrollWindow.ts`'s header comment for the full
     * writeup, including its relationship to the still-deferred `zoomscroll.js`). Needs
     * `visibleCount` set to a value smaller than `data.length` to render anything (a deliberate
     * simplification vs. source, which always draws a possibly-oversized, effectively undraggable
     * thumb - see this file's header comment). `zoomable` takes precedence if both are enabled. */
    scrollable?: boolean
    /** Ported from `widget/vscroll.js`. Same fixed-size row-index window as `scrollable`, but a
     * VERTICAL scrollbar (left of the plot area by default) whose thumb drags along y. Shares the
     * SAME underlying window as `scrollable` (confirmed from source: both widgets, even used
     * together, drive the identical `axis.zoom(start, start+bufferCount)` call on the same chart
     * axes) - enabling both scrolls the SAME window in lockstep, just via two different UI handles. */
    verticalScrollable?: boolean
    /** Number of rows visible at once when `scrollable`/`verticalScrollable` is enabled - this port's
     * explicit equivalent of source's per-axis `buffer` config (`axis.buffer`, default `10000` -
     * "Limits the number of elements shown on a chart"). Required for either prop to render/do
     * anything. */
    visibleCount?: number
    /** `'bottom'` (default) or `'top'` placement for the `scrollable` scrollbar - ported from
     * `scroll.js`'s own `orient` setup option (default `"bottom"`). */
    scrollOrient?: 'top' | 'bottom'
    /** `'left'` (default) or `'right'` placement for the `verticalScrollable` scrollbar - ported from
     * `vscroll.js`'s own `orient` setup option (default `"left"`). */
    verticalScrollOrient?: 'left' | 'right'
    /** Ported from `widget/zoomscroll.js`. A persistent control strip below the chart: drag either
     * edge handle to narrow the visible window from that side (real axis-domain rescale, like
     * `zoomable`), or drag the center pane to pan a fixed-width window (like `scrollable`'s thumb).
     * Backed by a real embedded thumbnail chart (`zoomScrollSymbol`) previewing the FULL, un-
     * windowed `data`. Shares `zoomable`'s own window state - `zoomable` takes precedence if both
     * are enabled. Only meaningful when `axisX.type === "block"` (silently a no-op otherwise, same
     * constraint as `zoomable`) - see this file's header comment/`useZoomScroll.ts`. */
    zoomScrollable?: boolean
    /** Which `target` series the embedded thumbnail chart previews. Defaults to `target[0]`. */
    zoomScrollKey?: string
    /** Chart type for the embedded thumbnail - `'area'` (default, matching `zoomscroll.js`'s own
     * `symbol: "area"` default) or `'line'`. */
    zoomScrollSymbol?: 'area' | 'line'
    /** Color for the embedded thumbnail series and the center pane's outline stroke (source reuses
     * the same `widget.color` for both - `chart.color(self.widget.color)`). Defaults to this
     * chart's own color for `zoomScrollKey`'s index in `target` (matching source's default `color:
     * 0`, this port's `pickColor(0)` equivalent when the key is `target[0]`). */
    zoomScrollColor?: string
  }>(),
  {
    width: 600,
    height: 400,
    theme: 'classic',
    padding: undefined,
    symbol: 'normal',
    showPoints: false,
    stacked: false,
    colors: undefined,
    opacity: undefined,
    showGrid: true,
    showTooltip: true,
    title: undefined,
    active: null,
    activeEvent: null,
    display: undefined,
    format: undefined,
    guideline: false,
    crosshair: false,
    crosshairXFormat: undefined,
    crosshairYFormat: undefined,
    zoomable: false,
    dragSelect: false,
    dragSelectMode: 'list',
    scrollable: false,
    verticalScrollable: false,
    visibleCount: undefined,
    scrollOrient: 'bottom',
    verticalScrollOrient: 'left',
    zoomScrollable: false,
    zoomScrollKey: undefined,
    zoomScrollSymbol: 'area',
    zoomScrollColor: undefined,
  },
)

/** `dragSelectMode="list"` (default) match - ported from `getTargetData()`, minus the `brush`
 * field (an internal engine handle with no Vue-port equivalent, same reasoning
 * `ChartElementEventPayload`'s own doc comment already gives for dropping it there). */
interface DragSelectItem {
  dataIndex: number
  dataKey: string
  data: DataRow
}

/** `dragSelectMode="area"` payload - ported from `emitDragArea()`'s `{x1,y1,x2,y2}`, each value
 * already run through `invertAxisValue()`. */
interface DragSelectRange {
  x1: string | number
  y1: string | number
  x2: string | number
  y2: string | number
}

const emit = defineEmits<{
  click: [payload: ChartElementEventPayload]
  dblclick: [payload: ChartElementEventPayload]
  contextmenu: [payload: ChartElementEventPayload]
  mouseover: [payload: ChartElementEventPayload]
  mouseout: [payload: ChartElementEventPayload]
  /** Ported from `zoom.js`'s `chart.emit("zoom.end", args)`/`"zoom.close"` - fires with the new
   * `{start, end}` row-index window after a completed drag-zoom, or `null` after a reset. */
  zoom: [window: ZoomWindow | null]
  /** Ported from `dragselect.js`'s `chart.emit("dragselect.end", ...)`. See `dragSelectMode`'s doc
   * comment for the two possible payload shapes. Not emitted for a degenerate (zero-width or
   * zero-height) drag, matching source's own `thumbWidth == 0 || thumbHeight == 0` guard. */
  dragselect: [selection: DragSelectItem[] | DragSelectRange]
  /** Ported from `zoomscroll.js`'s `chart.emit("zoomscroll.dragend"/"zoomscroll.render", [start, end
   * - 1])` - fires with the new `{start, end}` row-index window after a completed edge-resize or
   * center-pane drag (never `null`; unlike `zoomable` there's no reset gesture for this widget). */
  zoomscroll: [window: ZoomWindow]
}>()

/** Forwards a per-element DOM event for series `key`'s line path - see this file's header comment. */
function forwardEvent(type: ChartElementEventType, key: string, e: MouseEvent) {
  // `emit`'s per-event overloads can't be called with a union event-name type directly - `type`
  // is already narrowed to exactly this component's declared emits (see `defineEmits` above), so
  // this cast is sound, not a type-safety hole.
  ;(emit as (type: ChartElementEventType, payload: ChartElementEventPayload) => void)(type, { dataIndex: null, dataKey: key, data: null, event: e })
}

const targetRef = toRef(props, 'target')

// ---- zoomable (ported from widget/zoom.js) - see this file's header comment -------------------
// `null` = showing the full `props.data` (unzoomed). `windowedData` is what actually feeds
// `useChartLayout()`/`useSeries()` below (AND `ChartBase` in the template) - both axes' domains
// and every series point re-derive from this SLICE, exactly matching the real engine's
// `axis.zoom()` (see `useZoomWindow.ts`'s header comment for the source trace confirming this).
const zoomWindow = ref<ZoomWindow | null>(null)

// ---- scrollable/verticalScrollable (ported from widget/scroll.js/vscroll.js) - see this file's header
// comment/useScrollWindow.ts -----------------------------------------------------------------
// Row index into `props.data` at the start of the currently visible `visibleCount`-row window -
// the ONE shared piece of state both the horizontal and vertical scrollbar drag along (see this
// file's header comment for why they share it). Always 0 until a drag moves it - matching
// source's own `thumbLeft = 0`/`thumbTop = 0` initial state (the scrollbar starts flush left/top).
const scrollStart = ref(0)
const canHScroll = computed(() => props.scrollable && props.visibleCount != null && canScroll(props.data.length, props.visibleCount))
const canVScroll = computed(() => props.verticalScrollable && props.visibleCount != null && canScroll(props.data.length, props.visibleCount))
const scrollActive = computed(() => canHScroll.value || canVScroll.value)

const windowedData = computed<DataRow[]>(() => {
  // `zoomable`/`zoomScrollable` share the SAME `zoomWindow` ref (`zoomable` takes precedence when
  // both are enabled - see this file's header comment and `zoomScrollActive`'s own doc comment).
  if ((props.zoomable || zoomScrollActive.value) && zoomWindow.value) return props.data.slice(zoomWindow.value.start, zoomWindow.value.end)
  if (scrollActive.value && props.visibleCount != null) return props.data.slice(scrollStart.value, scrollStart.value + props.visibleCount)
  return props.data
})

// `area` (padding/plot-area geometry) IS destructured here (unlike `BarChart.vue`) for the
// `guideline`/`crosshair`/`zoomable` hit-rect and line extents below - `ax.scale()`/`ay.scale()`
// (via `toSeriesScale()`) still return absolute, padding-inclusive pixel coordinates for
// everything else in this file, so `area` is only ever used for that hover-only geometry, never as
// a translate (see `useChartLayout.ts`'s header comment on the double-translate bug this avoided).
const { area, axisX, axisY } = useChartLayout(
  windowedData,
  toRef(props, 'axisX'),
  toRef(props, 'axisY'),
  toRef(props, 'width'),
  toRef(props, 'height'),
  toRef(props, 'padding'),
)

const themeName = toRef(props, 'theme')
const colorResolver = useColorResolver()
const { theme, color: themeColor } = useTheme(themeName, colorResolver)

function pickColor(i: number): string {
  return props.colors?.[i] ?? themeColor(i)
}

const xScale = computed(() => toSeriesScale(axisX.value))
const yScale = computed(() => toSeriesScale(axisY.value))
const xType = computed(() => axisX.value.type)
const yType = computed(() => axisY.value.type)

// Both computeds stay live (not conditionally constructed) so toggling `props.stacked` at runtime
// reacts correctly - see this file's header comment.
const seriesNormal = useSeries(windowedData, targetRef, xScale, yScale, xType, yType)
const seriesStacked = useStackedSeries(windowedData, targetRef, xScale, yScale, xType, yType)
const series = computed(() => (props.stacked ? seriesStacked.value : seriesNormal.value))

const lineOpacity = computed(() => props.opacity ?? theme('lineBorderOpacity'))

// `activeEvent`-driven hover override: while set, this single target is treated as the sole
// "active" one (matching setActiveEffect()'s single-line highlight), taking precedence over the
// static `active` prop. `null` falls back to `props.active` (setActiveEffects()'s static state).
const hoveredTarget = ref<string | null>(null)
const effectiveActive = computed<string | string[] | null>(() => hoveredTarget.value ?? props.active)

function targetOpacity(key: string): number {
  return lineActiveOpacity(key, effectiveActive.value, lineOpacity.value, theme('lineDisableBorderOpacity'))
}

function onLineEvent(type: string, key: string) {
  if (props.activeEvent !== type) return

  if (type === 'click') {
    hoveredTarget.value = hoveredTarget.value === key ? null : key
  } else {
    hoveredTarget.value = key
  }
}

function onLineLeave(key: string) {
  // Only "un-hover" for a hover-style activeEvent (e.g. mouseover/mouseenter) - "click" pins the
  // highlighted series until another line is clicked, matching a click-to-pin interaction.
  if (props.activeEvent && props.activeEvent !== 'click' && hoveredTarget.value === key) {
    hoveredTarget.value = null
  }
}

function onPointOver(p: Point) {
  hover.value = p
  onLineEvent('mouseover', p.key)
}

function onPointOut(p: Point) {
  hover.value = null
  onLineLeave(p.key)
}

interface Segment {
  d: string
  color: string
}

/** Ported from LineBrush's createLine(): walks each contiguous non-null run and emits one path per run. */
const segmentsByTarget = computed<Segment[][]>(() =>
  series.value.map((pts, j) => {
    const segs: Segment[] = []
    const { x: xs, y: ys, value: vs } = pts
    const curveX = props.symbol === 'curve' ? curvePoints(xs) : null
    const curveY = props.symbol === 'curve' ? curvePoints(ys) : null

    let start: number | null = null
    let end: number | null = null

    for (let i = 0; i < xs.length - 1; i++) {
      if (vs[i] !== null && vs[i] !== undefined) start = i
      if (vs[i + 1] !== null && vs[i + 1] !== undefined) end = i + 1
      if (start === null || end === null || start === end) continue

      let d = `M ${xs[start]} ${ys[start]} `

      if (props.symbol === 'curve' && curveX && curveY) {
        d += `C ${curveX.p1[start]} ${curveY.p1[start]}, ${curveX.p2[start]} ${curveY.p2[start]}, ${xs[end]} ${ys[end]}`
      } else if (props.symbol === 'step') {
        const sx = xs[start] + (xs[end] - xs[start]) / 2
        d += `L ${sx} ${ys[start]} L ${sx} ${ys[end]} L ${xs[end]} ${ys[end]}`
      } else {
        d += `L ${xs[end]} ${ys[end]}`
      }

      segs.push({ d, color: pickColor(j) })
    }

    return segs
  }),
)

interface Point {
  x: number
  y: number
  value: number
  color: string
  key: string
  /** Does this point qualify for a persistent `display` label? See this file's header comment. */
  isDisplay: boolean
  /** Row index into `windowedData` - only consumed by `dragSelect`'s hit-testing below (see
   * `finalizeDragSelect`), unused by any existing (pre-`dragSelect`) template usage of `points`. */
  dataIndex: number
}

const points = computed<Point[]>(() => {
  const out: Point[] = []
  series.value.forEach((pts, j) => {
    for (let i = 0; i < pts.x.length; i++) {
      const value = pts.value[i]
      if (value === null || value === undefined) continue
      const isDisplay = (props.display === 'max' && pts.max[i]) || (props.display === 'min' && pts.min[i]) || props.display === 'all'
      out.push({ x: pts.x[i], y: pts.y[i], value, color: pickColor(j), key: props.target[j], isDisplay, dataIndex: i })
    }
  })
  return out
})

const displayPoints = computed(() => points.value.filter((p) => p.isDisplay))

function formatValue(value: number): string | number {
  return props.format ? props.format(value) : value
}

const hover = ref<Point | null>(null)

// ---- guideline / crosshair (ported from widget/guideline.js, widget/cross.js) -----------------
// See this file's header comment for the full overlap analysis / integration decision.

/** Converts a mousemove/mouseleave event on the hit-rect below into this chart's own SVG
 * user-unit (viewBox) space - `toSvgPoint()` is the pure part (unit-tested in
 * `useHoverGuide.spec.ts`); `getBoundingClientRect()` itself has to stay here (real DOM). */
function eventToPlotPoint(e: MouseEvent): { x: number; y: number } {
  const svg = (e.currentTarget as SVGGraphicsElement).ownerSVGElement
  if (!svg) return { x: 0, y: 0 }
  const rect = svg.getBoundingClientRect()
  return toSvgPoint(e.clientX, e.clientY, rect, props.width, props.height)
}

const guidelineRowIndex = ref<number | null>(null)
const crosshairPoint = ref<{ x: number; y: number } | null>(null)

function onHoverAreaMove(e: MouseEvent) {
  const { x, y } = eventToPlotPoint(e)

  if (dragStartX.value !== null) dragCurrentX.value = x

  if (dragSelectStartX.value !== null) {
    dragSelectCurrentX.value = x
    dragSelectCurrentY.value = y
  }

  if (props.guideline) {
    const positions = series.value[0]?.x ?? []
    const index = nearestIndexByPosition(positions, x)
    guidelineRowIndex.value = index >= 0 ? index : null
  }

  if (props.crosshair) {
    crosshairPoint.value = { x: clamp(x, area.value.x, area.value.x2), y: clamp(y, area.value.y, area.value.y2) }
  }
}

function onHoverAreaLeave() {
  // Deliberately does NOT finalize an in-progress zoom drag here (unlike source's own
  // `bg.mouseout -> endZoomAction()` wiring) - this port's hit-rect sits BELOW the line paths/
  // point markers (see the template comment on why), so a native `mouseleave` fires on it whenever
  // the pointer crosses onto one of THOSE elements mid-drag (they're painted on top), not only when
  // the pointer truly leaves the plot area. Finalizing here produced a real, observed bug: a drag
  // toward the far edge would terminate early the instant it grazed a line's invisible hit corridor,
  // zooming to a much narrower window than dragged. The `window`-level `mouseup` listener
  // (`onZoomDragWindowUp`, added in `onZoomDragStart`) is target-independent and robust regardless -
  // it alone finalizes the drag, matching source's INTENT (a drag that ends outside the tracked
  // element still resolves) without inheriting this port's z-order-specific false trigger.
  guidelineRowIndex.value = null
  crosshairPoint.value = null
}

// ---- zoomable (ported from widget/zoom.js) - see this file's header comment -------------------

/** Only a "block" x-axis supports a real index-window zoom - see `useZoomWindow.ts`'s header
 * comment for why (no `date`/`dateblock` x-axis kind exists in this port). */
const zoomActive = computed(() => props.zoomable && props.axisX.type === 'block')

const dragStartX = ref<number | null>(null)
const dragCurrentX = ref<number | null>(null)
let dragSvgEl: SVGSVGElement | null = null

function onZoomDragStart(e: MouseEvent) {
  if (!zoomActive.value) return
  const { x } = eventToPlotPoint(e)
  dragStartX.value = x
  dragCurrentX.value = x
  dragSvgEl = (e.currentTarget as SVGGraphicsElement).ownerSVGElement
  // Tracks mouseup on `window` (not just the hit-rect) so a drag that's released outside the SVG
  // entirely still resolves - matches source's own redundant `chart.mouseup`/`bg.mouseup`/
  // `bg.mouseout` listener chain, which exists for the same reason.
  window.addEventListener('mouseup', onZoomDragWindowUp)
}

function onZoomDragWindowUp(e: MouseEvent) {
  if (dragStartX.value === null) return
  if (dragSvgEl) {
    const rect = dragSvgEl.getBoundingClientRect()
    const { x } = toSvgPoint(e.clientX, e.clientY, rect, props.width, props.height)
    finalizeZoomDrag(x)
  } else {
    finalizeZoomDrag()
  }
}

/** Ported from `endZoomAction()`: computes the new window from the drag's pixel extent
 * (`computeDragZoomWindow`), clamps it (`clampZoomWindow`), and applies it - or does nothing for a
 * degenerate (zero-width/out-of-bounds) drag, same as source's `thumbWidth == 0` guard. */
function finalizeZoomDrag(endX?: number) {
  window.removeEventListener('mouseup', onZoomDragWindowUp)
  if (dragStartX.value === null) return
  const start = dragStartX.value
  const end = endX ?? dragCurrentX.value ?? start
  const currentStart = zoomWindow.value?.start ?? 0
  const raw = computeDragZoomWindow(area.value.x, area.value.x2 - area.value.x, windowedData.value.length, currentStart, start, end)
  const clamped = clampZoomWindow(raw, props.data.length)

  dragStartX.value = null
  dragCurrentX.value = null
  dragSvgEl = null

  if (clamped) {
    zoomWindow.value = clamped
    emit('zoom', clamped)
  }
}

/** Ported from `rollbackZoom()`'s `"block"` branch (`axis.screen(1)`) - this port has no
 * pagination, so "reset" is simply "show the full `data` prop again". */
function resetZoom() {
  zoomWindow.value = null
  emit('zoom', null)
}

onBeforeUnmount(() => window.removeEventListener('mouseup', onZoomDragWindowUp))

/** Live drag-thumb rect extent while a zoom drag is in progress, or `null` when not dragging. */
const zoomThumb = computed<{ x: number; width: number } | null>(() => {
  if (dragStartX.value === null || dragCurrentX.value === null) return null
  const x1 = Math.min(dragStartX.value, dragCurrentX.value)
  const x2 = Math.max(dragStartX.value, dragCurrentX.value)
  return { x: x1, width: x2 - x1 }
})

// ---- dragSelect (ported from widget/dragselect.js) - see this file's header comment/useDragSelect.ts ----

const dragSelectStartX = ref<number | null>(null)
const dragSelectStartY = ref<number | null>(null)
const dragSelectCurrentX = ref<number | null>(null)
const dragSelectCurrentY = ref<number | null>(null)
let dragSelectSvgEl: SVGSVGElement | null = null

function onDragSelectStart(e: MouseEvent) {
  // `zoomable` takes precedence when both are enabled on the same hit-rect - see this file's
  // header comment.
  if (!props.dragSelect || zoomActive.value) return
  const { x, y } = eventToPlotPoint(e)
  dragSelectStartX.value = x
  dragSelectStartY.value = y
  dragSelectCurrentX.value = x
  dragSelectCurrentY.value = y
  dragSelectSvgEl = (e.currentTarget as SVGGraphicsElement).ownerSVGElement
  // Same `window`-level mouseup pattern as `onZoomDragStart` above (see this file's header
  // comment for why finalizing on the hit-rect's own mouseleave/mouseup is unsafe here).
  window.addEventListener('mouseup', onDragSelectWindowUp)
}

function onDragSelectWindowUp(e: MouseEvent) {
  if (dragSelectStartX.value === null) return
  if (dragSelectSvgEl) {
    const rect = dragSelectSvgEl.getBoundingClientRect()
    const { x, y } = toSvgPoint(e.clientX, e.clientY, rect, props.width, props.height)
    finalizeDragSelect(x, y)
  } else {
    finalizeDragSelect()
  }
}

/** Ported from `endZoomAction()`/`searchDataInDrag()`/`emitDataList()`/`emitDragArea()` (all in
 * `dragselect.js`): resolves the completed drag's pixel rectangle, then either hit-tests every
 * rendered point against it (`dragSelectMode="list"`) or just normalizes+inverts the two corners
 * (`dragSelectMode="area"`) - see `useDragSelect.ts`'s header comment for the full source mapping.
 * Emits nothing for a degenerate (zero-width or zero-height) drag, same as source's own
 * `thumbWidth == 0 || thumbHeight == 0` guard. */
function finalizeDragSelect(endX?: number, endY?: number) {
  window.removeEventListener('mouseup', onDragSelectWindowUp)
  const startX = dragSelectStartX.value
  const startY = dragSelectStartY.value
  const finalX = endX ?? dragSelectCurrentX.value
  const finalY = endY ?? dragSelectCurrentY.value

  dragSelectStartX.value = null
  dragSelectStartY.value = null
  dragSelectCurrentX.value = null
  dragSelectCurrentY.value = null
  dragSelectSvgEl = null

  if (startX === null || startY === null || finalX === null || finalY === null) return
  if (isDegenerateDragRect(startX, startY, finalX, finalY)) return

  if (props.dragSelectMode === 'area') {
    const rect = normalizeDragRect(startX, startY, finalX, finalY)
    emit('dragselect', {
      x1: invertAxisValue(axisX.value, rect.x1),
      y1: invertAxisValue(axisY.value, rect.y1),
      x2: invertAxisValue(axisX.value, rect.x2),
      y2: invertAxisValue(axisY.value, rect.y2),
    })
  } else {
    const matches = pointsInDragRect(
      points.value.map((p) => ({ x: p.x, y: p.y, dataIndex: p.dataIndex, dataKey: p.key })),
      startX,
      startY,
      finalX,
      finalY,
    )
    emit(
      'dragselect',
      matches.map((m) => ({ dataIndex: m.dataIndex, dataKey: m.dataKey, data: windowedData.value[m.dataIndex] })),
    )
  }
}

onBeforeUnmount(() => window.removeEventListener('mouseup', onDragSelectWindowUp))

// ---- scrollable/verticalScrollable (ported from widget/scroll.js/vscroll.js) - see this file's header
// comment/useScrollWindow.ts -----------------------------------------------------------------

const hTrackSize = computed(() => area.value.x2 - area.value.x)
const vTrackSize = computed(() => area.value.y2 - area.value.y)
const hThumbSize = computed(() => (canHScroll.value ? computeThumbSize(hTrackSize.value, props.visibleCount!, props.data.length) : 0))
const vThumbSize = computed(() => (canVScroll.value ? computeThumbSize(vTrackSize.value, props.visibleCount!, props.data.length) : 0))

/** Resting (not currently being dragged) thumb gap, derived from the committed `scrollStart` - see
 * `computeThumbGapFromStart`'s own header comment for why this is a derived value in this port
 * (unlike source, where the gap itself is the single source of truth). */
const hThumbGapResting = computed(() => (canHScroll.value ? computeThumbGapFromStart(scrollStart.value, hTrackSize.value, props.data.length, hThumbSize.value) : 0))
const vThumbGapResting = computed(() => (canVScroll.value ? computeThumbGapFromStart(scrollStart.value, vTrackSize.value, props.data.length, vThumbSize.value) : 0))

/** `null` when no scrollbar-thumb drag is in progress; otherwise which track ('h'/'v') is being
 * dragged - only one drag can be active at a time (a single pointer), even though `scrollable`/
 * `verticalScrollable` share one `scrollStart`. */
const scrollDragAxis = ref<'h' | 'v' | null>(null)
const scrollDragMouseStart = ref(0)
const scrollDragGapStart = ref(0)
/** Live drag gap, updated on every `window` `mousemove` tick while dragging - rendered directly
 * (not re-derived through `computeThumbGapFromStart`) for the same reason `zoomThumb`/
 * `dragSelectThumb` above render straight off live drag state instead of the committed window. */
const scrollDragGap = ref(0)
let scrollDragSvgEl: SVGSVGElement | null = null

/** Ported from `mousedown()`: captures the pointer's starting position and the thumb's current
 * gap, so `mousemove` can compute `thumbStart + delta` exactly like source's own `gap = thumbStart
 * + e.bgX - mouseStart`. Uses this file's existing `eventToPlotPoint()` (SVG-viewBox space, correct
 * under CSS scaling) rather than raw `clientX`/`clientY`, matching `onZoomDragStart`'s/
 * `onDragSelectStart`'s own convention. */
function onScrollDragStart(axis: 'h' | 'v', e: MouseEvent) {
  if (axis === 'h' ? !canHScroll.value : !canVScroll.value) return
  const { x, y } = eventToPlotPoint(e)
  scrollDragAxis.value = axis
  scrollDragMouseStart.value = axis === 'h' ? x : y
  scrollDragGapStart.value = axis === 'h' ? hThumbGapResting.value : vThumbGapResting.value
  scrollDragGap.value = scrollDragGapStart.value
  scrollDragSvgEl = (e.currentTarget as SVGGraphicsElement).ownerSVGElement
  // `window`-level mousemove AND mouseup (not just mouseup like `zoomable`/`dragSelect` above) -
  // see this file's header comment for why a continuous drag needs both.
  window.addEventListener('mousemove', onScrollDragWindowMove)
  window.addEventListener('mouseup', onScrollDragWindowUp)
}

/** Ported from `mousemove()`: recomputes the thumb's gap from the live pointer delta, clamps it
 * into the track, and derives+commits the new `scrollStart` row index - all on every tick, matching
 * source's own "recompute and re-render on every mousemove" behavior (unlike `zoomable`/
 * `dragSelect`, which only resolve once on release). */
function onScrollDragWindowMove(e: MouseEvent) {
  const axis = scrollDragAxis.value
  if (axis === null || props.visibleCount == null || !scrollDragSvgEl) return
  const rect = scrollDragSvgEl.getBoundingClientRect()
  const { x, y } = toSvgPoint(e.clientX, e.clientY, rect, props.width, props.height)
  const mouseNow = axis === 'h' ? x : y
  const trackSize = axis === 'h' ? hTrackSize.value : vTrackSize.value
  const thumbSize = axis === 'h' ? hThumbSize.value : vThumbSize.value
  const gap = clampThumbGap(scrollDragGapStart.value + (mouseNow - scrollDragMouseStart.value), thumbSize, trackSize)
  scrollDragGap.value = gap
  scrollStart.value = computeScrollStart(gap, thumbSize, trackSize, props.data.length, props.visibleCount)
}

function onScrollDragWindowUp() {
  window.removeEventListener('mousemove', onScrollDragWindowMove)
  window.removeEventListener('mouseup', onScrollDragWindowUp)
  scrollDragAxis.value = null
  scrollDragSvgEl = null
}

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onScrollDragWindowMove)
  window.removeEventListener('mouseup', onScrollDragWindowUp)
})

/** Rendered thumb gap: the live drag value while dragging that axis, otherwise the resting
 * (committed-`scrollStart`-derived) value. */
const hThumbGap = computed(() => (scrollDragAxis.value === 'h' ? scrollDragGap.value : hThumbGapResting.value))
const vThumbGap = computed(() => (scrollDragAxis.value === 'v' ? scrollDragGap.value : vThumbGapResting.value))

/** Ported from `draw()`'s `bgY`/`bgX`: the scrollbar track's cross-axis position (`scrollOrient`/
 * `verticalScrollOrient` pick which edge, matching `scroll.js`'s/`vscroll.js`'s own `orient` setup
 * option). */
const hScrollY = computed(() => (props.scrollOrient === 'top' ? area.value.y - theme('scrollBackgroundSize') : area.value.y2))
const vScrollX = computed(() => (props.verticalScrollOrient === 'right' ? area.value.x2 : area.value.x - theme('scrollBackgroundSize')))

/** Live rubber-band rect extent while a dragSelect drag is in progress, or `null` when not
 * dragging - ported from `onDrawStart()`'s `thumb` rect (both axes, unlike `zoomThumb`'s x-only
 * one). */
const dragSelectThumb = computed<{ x: number; y: number; width: number; height: number } | null>(() => {
  if (dragSelectStartX.value === null || dragSelectCurrentX.value === null || dragSelectStartY.value === null || dragSelectCurrentY.value === null) return null
  const x1 = Math.min(dragSelectStartX.value, dragSelectCurrentX.value)
  const x2 = Math.max(dragSelectStartX.value, dragSelectCurrentX.value)
  const y1 = Math.min(dragSelectStartY.value, dragSelectCurrentY.value)
  const y2 = Math.max(dragSelectStartY.value, dragSelectCurrentY.value)
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
})

// ---- zoomScrollable (ported from widget/zoomscroll.js) - see this file's header comment/useZoomScroll.ts ----

/** Same `"block"` x-axis constraint as `zoomable` (see `zoomActive`'s doc comment/`useZoomWindow.ts`'s
 * header comment) - `zoomable` takes precedence when both are enabled (shares its `zoomWindow` ref). */
const zoomScrollActive = computed(() => props.zoomScrollable && !props.zoomable && props.axisX.type === 'block')

const zsKey = computed(() => props.zoomScrollKey ?? props.target[0])
const zsColor = computed(() => props.zoomScrollColor ?? pickColor(Math.max(0, props.target.indexOf(zsKey.value))))

/** `count` in `useZoomScroll.ts`'s terms - the FULL un-windowed row count (`axis.origin.length`
 * upstream), not `windowedData.value.length`. */
const zsCount = computed(() => props.data.length)
const zsTrackWidth = computed(() => Math.max(0, area.value.x2 - area.value.x - theme('zoomScrollAreaBorderWidth') * 2))
const zsHeight = computed(() => Math.max(0, theme('zoomScrollBackgroundSize') - theme('zoomScrollAreaBorderWidth') * 2))
const zsTick = computed(() => computeZoomScrollTick(zsTrackWidth.value, zsCount.value))

/** The currently COMMITTED window (shared `zoomWindow` ref), defaulting to the full range - ported
 * from `drawBefore()`'s `start = axis.start; end = axis.end` (which default to `0`/`origin.length`
 * before any zoom has run). */
const zsCommittedStart = computed(() => zoomWindow.value?.start ?? 0)
const zsCommittedEnd = computed(() => zoomWindow.value?.end ?? zsCount.value)
const zsResting = computed(() => computeZoomScrollRestingWidths(zsCommittedStart.value, zsCommittedEnd.value, zsCount.value, zsTick.value))

/** `null` when no edge/center drag is in progress; otherwise which gesture is active. Only one can
 * be active at a time (a single pointer), matching source's own per-handle `isMove` guards. */
const zsDragKind = ref<'left' | 'right' | 'center' | null>(null)
const zsDragMouseStartX = ref(0)
/** The dragged side's own pixel width/position captured at `mousedown` (source's `bgWidth`/
 * `centerStart`) - `dis` (cumulative pointer delta since) is added/subtracted from this FIXED
 * anchor every tick, never incrementally from the previous tick - see `useZoomScroll.ts`'s header
 * comment for why that's what makes the hard-clamp-vs-reject simplification behave identically. */
const zsDragInitialWidth = ref(0)
/** The OTHER (undragged) side's width, held fixed for the whole drag - `rightWidth` for a left-edge
 * drag, `leftWidth` for a right-edge drag, the center pane's own fixed width for a center drag. */
const zsDragOtherWidth = ref(0)
const zsDragLiveWidth = ref(0)
let zsDragSvgEl: SVGSVGElement | null = null

function startZoomScrollDrag(kind: 'left' | 'right' | 'center', e: MouseEvent) {
  if (!zoomScrollActive.value) return
  const { x } = eventToPlotPoint(e)
  zsDragKind.value = kind
  zsDragMouseStartX.value = x
  zsDragInitialWidth.value = kind === 'right' ? zsResting.value.rightWidth : zsResting.value.leftWidth
  zsDragOtherWidth.value = kind === 'left' ? zsResting.value.rightWidth : kind === 'right' ? zsResting.value.leftWidth : zsTrackWidth.value - zsResting.value.leftWidth - zsResting.value.rightWidth
  zsDragLiveWidth.value = zsDragInitialWidth.value
  zsDragSvgEl = (e.currentTarget as SVGGraphicsElement).ownerSVGElement
  // `window`-level mousemove AND mouseup, same reasoning as `scrollable`'s own thumb drag above -
  // a continuous, live-updating gesture (source's `dragZoomAction()` runs on every `chart.mousemove`/
  // `bg.mousemove` tick) whose pointer routinely leaves the small handle/pane elements mid-drag.
  window.addEventListener('mousemove', onZoomScrollWindowMove)
  window.addEventListener('mouseup', onZoomScrollWindowUp)
}

/** Ported from `dragZoomAction()`: recomputes the dragged side's live pixel width from the pointer's
 * cumulative delta every tick (chrome-only - see this file's header comment for why the actual data
 * window doesn't commit until `mouseup`, unlike `scrollable`). */
function onZoomScrollWindowMove(e: MouseEvent) {
  const kind = zsDragKind.value
  if (kind === null || !zsDragSvgEl) return
  const rect = zsDragSvgEl.getBoundingClientRect()
  const { x } = toSvgPoint(e.clientX, e.clientY, rect, props.width, props.height)
  const dis = x - zsDragMouseStartX.value

  if (kind === 'left') {
    zsDragLiveWidth.value = computeLeftEdgeWidth(zsDragInitialWidth.value, dis, zsDragOtherWidth.value, zsTick.value, zsTrackWidth.value)
  } else if (kind === 'right') {
    zsDragLiveWidth.value = computeRightEdgeWidth(zsDragInitialWidth.value, dis, zsDragOtherWidth.value, zsTick.value, zsTrackWidth.value)
  } else {
    zsDragLiveWidth.value = computeCenterPanLeftWidth(zsDragInitialWidth.value, dis, zsDragOtherWidth.value, zsTrackWidth.value)
  }
}

/** Ported from `endZoomAction()`: resolves the drag's final live width into a `{start, end}` window
 * (`resolveLeftEdgeWindow`/`resolveRightEdgeWindow`/`resolveCenterPanWindow`), clamps it via the
 * SAME `clampZoomWindow` `zoomable` uses (confirmed in `zoom.js`'s own PORT_STATUS.md entry to
 * already clamp against `originLength` exactly like `zoomscroll.js`'s own `count`), and commits it
 * to the shared `zoomWindow` ref. */
function onZoomScrollWindowUp() {
  window.removeEventListener('mousemove', onZoomScrollWindowMove)
  window.removeEventListener('mouseup', onZoomScrollWindowUp)
  const kind = zsDragKind.value
  zsDragKind.value = null
  zsDragSvgEl = null
  if (kind === null) return

  const raw =
    kind === 'left'
      ? resolveLeftEdgeWindow(zsDragLiveWidth.value, zsTick.value, zsCommittedEnd.value)
      : kind === 'right'
        ? resolveRightEdgeWindow(zsDragLiveWidth.value, zsTick.value, zsCount.value, zsCommittedStart.value)
        : resolveCenterPanWindow(zsDragLiveWidth.value, zsTick.value, zsCommittedStart.value, zsCommittedEnd.value)

  const clamped = clampZoomWindow(raw, props.data.length)
  if (clamped) {
    zoomWindow.value = clamped
    emit('zoomscroll', clamped)
  }
}

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onZoomScrollWindowMove)
  window.removeEventListener('mouseup', onZoomScrollWindowUp)
})

/** Rendered left/right dimmed-zone widths: live drag value while that side is being dragged
 * (a center drag moves BOTH - ported from `dragZoomAction()`'s `isCenter` branch redrawing `l_rect`
 * AND `r_rect`, not just `c_rect`), otherwise the resting (committed-window-derived) value. */
const zsLeftWidth = computed(() => (zsDragKind.value === 'left' || zsDragKind.value === 'center' ? zsDragLiveWidth.value : zsResting.value.leftWidth))
const zsRightWidth = computed(() =>
  zsDragKind.value === 'right' ? zsDragLiveWidth.value : zsDragKind.value === 'center' ? zsTrackWidth.value - zsDragLiveWidth.value - zsDragOtherWidth.value : zsResting.value.rightWidth,
)
const zsCenterX = computed(() => zsLeftWidth.value)
const zsCenterWidth = computed(() => Math.max(0, zsTrackWidth.value - zsLeftWidth.value - zsRightWidth.value))

const zsAreaBorderWidth = computed(() => theme('zoomScrollAreaBorderWidth'))
const zsAreaBorderRadius = computed(() => theme('zoomScrollAreaBorderRadius'))
const zsButtonSize = computed(() => theme('zoomScrollButtonSize'))
/** Widget group's own translate - ported from `draw()`'s `.translate(widget.dx + area.x, widget.dy
 * + area.y2 - b)`. This port has no `dx`/`dy` widget-offset equivalent (no demo/consumer needs a
 * non-default position - dropped as a deliberate, disclosed simplification, matching this file's
 * "trimmed to what's actually used" convention elsewhere). */
const zsGroupY = computed(() => area.value.y2 - zsAreaBorderWidth.value)

/** Left dimmed-zone rounded-rect path (outer/left corners rounded, inner/right corners square) -
 * ported from `l_rect.round(lw, h, radius, 0, 0, radius)`. Radius clamped per-side (see
 * `clampCornerRadius`'s doc comment) since this zone can shrink to just a few pixels wide mid-drag,
 * unlike any existing `roundedRectPath()` caller (`BarChart`/`RateBarChart`'s bars). */
const zsLeftRadius = computed(() => clampCornerRadius(zsAreaBorderRadius.value, zsLeftWidth.value, zsHeight.value))
const zsRightRadius = computed(() => clampCornerRadius(zsAreaBorderRadius.value, zsRightWidth.value, zsHeight.value))
const zsLeftPath = computed(() => roundedRectPath(0, 0, zsLeftWidth.value, zsHeight.value, zsLeftRadius.value, 0, 0, zsLeftRadius.value))
/** Right dimmed-zone rounded-rect path (outer/right corners rounded, inner/left corners square) -
 * ported from `r_rect.round(rw, h, 0, radius, radius, 0)` + its own `.translate(w - rw, 0)`. */
const zsRightPath = computed(() => roundedRectPath(zsTrackWidth.value - zsRightWidth.value, 0, zsRightWidth.value, zsHeight.value, 0, zsRightRadius.value, zsRightRadius.value, 0))

/** Embedded thumbnail chart's own axis config - ported from `createChartImage()`'s `axis.x`/`axis.y`
 * merge. **Simplified merge, documented deviation**: source's own `_.extend(defaults, axis.get("x"),
 * true)` lets the HOST's already-resolved x-axis object override the forced `hide:false`/`line:
 * "solid"` defaults for any key it itself defines (so the thumbnail's x-axis chrome isn't always
 * force-visible upstream either, depending on the host's own config) - this port instead always
 * forces `hide: false` on x (so the thumbnail's own tick labels are never accidentally suppressed by
 * a host `hide: true`) while inheriting everything else (`type`/`domain`/`orient`/`line`) as-is from
 * `props.axisX`, a simpler and more predictable rule for a component library than replicating the
 * upstream merge-precedence quirk. The y-axis is always forced `hide: true, line: false`,
 * unconditionally - matching source's clear INTENT (the track is too short for a meaningful y
 * scale) even though the literal upstream merge could in principle be overridden by an unusual host
 * config. No tick-label `format` callback is threaded through (`widget.format`'s equivalent) - this
 * port has no chart-wide axis tick-format mechanism anywhere yet (`ChartBase.vue` always renders
 * `axisX.ticks[i]` raw - see its template), not just for this widget, so there's no existing hook to
 * plug one into without a larger, unrelated infrastructure change. */
const zsThumbAxisX = computed<AxisConfig>(() => ({ ...props.axisX, hide: false }) as AxisConfig)
const zsThumbAxisY = computed<AxisConfig>(() => ({ ...props.axisY, hide: true, line: false }) as AxisConfig)
const zsThumbPadding = computed(() => ({ top: 0, right: 0, left: 0, bottom: theme('zoomScrollGridFontSize') + 8 }))

/** Snapped x pixel of the guideline, or `null` while inactive/no data. */
const guidelineX = computed<number | null>(() => {
  if (guidelineRowIndex.value === null) return null
  return series.value[0]?.x[guidelineRowIndex.value] ?? null
})

interface GuidelineItem {
  key: string
  value: string | number
  color: string
  y: number
}

/** One entry per target with a non-null value at the snapped row - ported from `guideline.js`'s
 * `drawContentTooltip()` (`brush.target.forEach(...)`), ready for both the per-target point
 * markers below and the `ChartTooltip` content box. */
const guidelineItems = computed<GuidelineItem[]>(() => {
  if (guidelineRowIndex.value === null) return []
  const index = guidelineRowIndex.value
  const out: GuidelineItem[] = []
  series.value.forEach((pts, j) => {
    const value = pts.value[index]
    if (value === null || value === undefined) return
    out.push({ key: props.target[j], value: formatValue(value), color: pickColor(j), y: pts.y[index] })
  })
  return out
})

/** Content tooltip anchor y: above the topmost (highest-value) point at the snapped row, so the
 * box never overlaps any of the per-target markers it lists - a simplification vs. `guideline.js`'s
 * own left/right-flip box placement (see this file's header comment). */
const guidelineTooltipY = computed(() => (guidelineItems.value.length ? Math.min(...guidelineItems.value.map((it) => it.y)) : area.value.y))

const showCrosshairX = computed(() => props.crosshair === true || props.crosshair === 'both' || props.crosshair === 'x')
const showCrosshairY = computed(() => props.crosshair === true || props.crosshair === 'both' || props.crosshair === 'y')

const crosshairXValue = computed<string | number | null>(() => {
  if (!crosshairPoint.value) return null
  const value = invertAxisValue(axisX.value, crosshairPoint.value.x)
  return props.crosshairXFormat ? props.crosshairXFormat(value) : value
})

const crosshairYValue = computed<string | number | null>(() => {
  if (!crosshairPoint.value) return null
  const value = invertAxisValue(axisY.value, crosshairPoint.value.y)
  return props.crosshairYFormat ? props.crosshairYFormat(value) : value
})
</script>

<template>
  <ChartBase :data="windowedData" :axis-x="props.axisX" :axis-y="props.axisY" :width="props.width" :height="props.height" :theme="props.theme" :padding="props.padding" :show-grid="props.showGrid" :color-resolver="colorResolver">
    <g>
      <!-- guideline/crosshair/zoomable hit-rect: placed BELOW the lines/points below it (z-order
           lowest), so hovering exactly on an existing line/point still triggers that element's own
           mouseover/mouseout (e.g. the per-point hover tooltip) instead of being swallowed here.
           Its own tooltip(s) below (`ChartTooltip`, rendered in the overlay slot on top of
           everything, including this rect) render `pointer-events: none` - found the hard way: a
           value balloon can appear directly under the still-hovering pointer here (unlike
           `ChartTooltip`'s other, point-anchored callers), and without that it becomes the topmost
           hit-test target at that pixel, firing a native `mouseleave` on this rect even though the
           pointer never physically moved - a self-covering flicker loop. See `ChartTooltip.vue`'s
           header comment for the full writeup. -->
      <rect
        v-if="props.guideline || props.crosshair || zoomActive || props.dragSelect"
        data-testid="hover-guide-area"
        :x="area.x"
        :y="area.y"
        :width="area.x2 - area.x"
        :height="area.y2 - area.y"
        fill="transparent"
        :style="{ 'pointer-events': 'all', cursor: zoomActive || props.dragSelect ? 'crosshair' : undefined }"
        @mousemove="onHoverAreaMove"
        @mouseleave="onHoverAreaLeave"
        @mousedown="
          (e) => {
            onZoomDragStart(e)
            onDragSelectStart(e)
          }
        "
      />

      <g v-if="props.guideline && guidelineX !== null" style="pointer-events: none">
        <line :x1="guidelineX" :x2="guidelineX" :y1="area.y" :y2="area.y2" :stroke="theme('guidelineBorderColor')" :stroke-width="theme('guidelineBorderWidth')" :stroke-dasharray="theme('guidelineBorderDashArray')" :stroke-opacity="theme('guidelineBorderOpacity')" />
        <circle v-for="(it, i) in guidelineItems" :key="i" :cx="guidelineX" :cy="it.y" :r="theme('guidelinePointRadius')" :fill="it.color" :stroke="theme('guidelinePointBorderColor')" :stroke-width="theme('guidelinePointBorderWidth')" />
      </g>

      <g v-if="props.crosshair && crosshairPoint" style="pointer-events: none">
        <line v-if="showCrosshairX" :x1="crosshairPoint.x" :x2="crosshairPoint.x" :y1="area.y" :y2="area.y2" :stroke="theme('crossBorderColor')" :stroke-width="theme('crossBorderWidth')" :stroke-opacity="theme('crossBorderOpacity')" />
        <line v-if="showCrosshairY" :x1="area.x" :x2="area.x2" :y1="crosshairPoint.y" :y2="crosshairPoint.y" :stroke="theme('crossBorderColor')" :stroke-width="theme('crossBorderWidth')" :stroke-opacity="theme('crossBorderOpacity')" />
      </g>

      <!-- zoomable: live drag thumb, ported from zoom.js's drawSection() `thumb` rect. -->
      <rect
        v-if="zoomThumb"
        data-testid="zoom-thumb"
        :x="zoomThumb.x"
        :y="area.y"
        :width="zoomThumb.width"
        :height="area.y2 - area.y"
        :fill="theme('zoomBackgroundColor')"
        opacity="0.3"
        style="pointer-events: none"
      />

      <!-- zoomable: reset ("×") icon, shown once a zoom is active - ported from zoom.js's `bg`
           group (`visibility: hidden` until a zoom completes) + `rollbackZoom()`'s close handler. -->
      <g v-if="zoomActive && zoomWindow" data-testid="zoom-reset" style="cursor: pointer" @click="resetZoom">
        <!-- Centered on the plot area's top-right corner (area.x2, area.y), matching source's
             `circle cx=cw cy=0 r=12` inside a group translated to (axis.area("x"), axis.area("y")). -->
        <circle :cx="area.x2" :cy="area.y" r="12" opacity="0" />
        <path
          d="M12,2C6.5,2,2,6.5,2,12c0,5.5,4.5,10,10,10s10-4.5,10-10C22,6.5,17.5,2,12,2z M16.9,15.5l-1.4,1.4L12,13.4l-3.5,3.5 l-1.4-1.4l3.5-3.5L7.1,8.5l1.4-1.4l3.5,3.5l3.5-3.5l1.4,1.4L13.4,12L16.9,15.5z"
          :fill="theme('zoomFocusColor')"
          :transform="`translate(${area.x2 - 12}, ${area.y - 12})`"
        />
      </g>

      <!-- dragSelect: live rubber-band rect (both axes), ported from dragselect.js's onDrawStart()
           `thumb` rect. -->
      <rect
        v-if="dragSelectThumb"
        data-testid="dragselect-thumb"
        :x="dragSelectThumb.x"
        :y="dragSelectThumb.y"
        :width="dragSelectThumb.width"
        :height="dragSelectThumb.height"
        :fill="theme('dragSelectBackgroundColor')"
        :fill-opacity="theme('dragSelectBackgroundOpacity')"
        :stroke="theme('dragSelectBorderColor')"
        :stroke-width="theme('dragSelectBorderWidth')"
        style="pointer-events: none"
      />

      <!-- scrollable: horizontal scrollbar (track + draggable thumb), ported from widget/scroll.js's
           draw(). Positioned at area.y2 (bottom, default) or area.y - bgSize (top) - see
           `scrollOrient`'s doc comment. -->
      <g v-if="canHScroll" data-testid="scroll-h">
        <rect :x="area.x" :y="hScrollY" :width="hTrackSize" :height="theme('scrollBackgroundSize')" :fill="theme('scrollBackgroundColor')" />
        <rect
          data-testid="scroll-h-thumb"
          :x="area.x + hThumbGap"
          :y="hScrollY + 1"
          :width="hThumbSize"
          :height="theme('scrollBackgroundSize') - 2"
          :fill="theme('scrollThumbBackgroundColor')"
          :stroke="theme('scrollThumbBorderColor')"
          stroke-width="1"
          style="cursor: pointer"
          @mousedown="(e) => onScrollDragStart('h', e)"
        />
      </g>

      <!-- verticalScrollable: vertical scrollbar, ported from widget/vscroll.js's draw(). Positioned at
           area.x - bgSize (left, default) or area.x2 (right) - see `verticalScrollOrient`'s doc comment. -->
      <g v-if="canVScroll" data-testid="scroll-v">
        <rect :x="vScrollX" :y="area.y" :width="theme('scrollBackgroundSize')" :height="vTrackSize" :fill="theme('scrollBackgroundColor')" />
        <rect
          data-testid="scroll-v-thumb"
          :x="vScrollX + 1"
          :y="area.y + vThumbGap"
          :width="theme('scrollBackgroundSize') - 2"
          :height="vThumbSize"
          :fill="theme('scrollThumbBackgroundColor')"
          :stroke="theme('scrollThumbBorderColor')"
          stroke-width="1"
          style="cursor: pointer"
          @mousedown="(e) => onScrollDragStart('v', e)"
        />
      </g>

      <!-- zoomScrollable: persistent resize/pan control strip below the chart, ported from
           widget/zoomscroll.js's draw(). See this file's header comment/useZoomScroll.ts for the
           full source mapping. Local coordinates (0,0)..(zsTrackWidth,zsHeight) inside this
           translated group. -->
      <g v-if="zoomScrollActive" data-testid="zoomscroll" :transform="`translate(${area.x}, ${zsGroupY})`">
        <!-- Embedded thumbnail: a real small nested chart (this port's equivalent of source's
             chart.builder()-and-serialize-to-<image> trick - see this file's header comment for
             why nesting an actual component is the natural Vue equivalent, not a shortcut) showing
             the FULL un-windowed `data` (never `windowedData`) for `zoomScrollKey` alone. -->
        <AreaChart
          v-if="props.zoomScrollSymbol === 'area'"
          :data="props.data"
          :target="[zsKey]"
          :axis-x="zsThumbAxisX"
          :axis-y="zsThumbAxisY"
          :width="zsTrackWidth"
          :height="zsHeight"
          :theme="props.theme"
          :padding="zsThumbPadding"
          :colors="[zsColor]"
          :opacity="theme('zoomScrollBrushAreaBackgroundOpacity')"
          :show-grid="false"
          :show-tooltip="false"
          style="pointer-events: none; max-width: none"
        />
        <LineChart
          v-else
          :data="props.data"
          :target="[zsKey]"
          :axis-x="zsThumbAxisX"
          :axis-y="zsThumbAxisY"
          :width="zsTrackWidth"
          :height="zsHeight"
          :theme="props.theme"
          :padding="zsThumbPadding"
          :colors="[zsColor]"
          :show-grid="false"
          :show-tooltip="false"
          style="pointer-events: none; max-width: none"
        />

        <!-- Left/right dimmed zones (outside the visible window) - ported from l_rect/r_rect. -->
        <path v-if="zsLeftWidth > 0" :d="zsLeftPath" :fill="theme('zoomScrollAreaBackgroundColor')" :fill-opacity="theme('zoomScrollAreaBackgroundOpacity')" :stroke="theme('zoomScrollAreaBorderColor')" :stroke-width="zsAreaBorderWidth" />
        <path v-if="zsRightWidth > 0" :d="zsRightPath" :fill="theme('zoomScrollAreaBackgroundColor')" :fill-opacity="theme('zoomScrollAreaBackgroundOpacity')" :stroke="theme('zoomScrollAreaBorderColor')" :stroke-width="zsAreaBorderWidth" />

        <!-- Center pane (drag to pan) - ported from c_rect. -->
        <rect
          data-testid="zoomscroll-center"
          :x="zsCenterX"
          y="0"
          :width="zsCenterWidth"
          :height="zsHeight"
          fill="transparent"
          :stroke="zsColor"
          :stroke-width="zsAreaBorderWidth"
          style="cursor: move"
          @mousedown="(e) => startZoomScrollDrag('center', e)"
        />

        <!-- Left/right edge-resize handles - ported from l_ctrl/r_ctrl. Fill/stroke are hardcoded
             literals in source itself (no zoomScroll* theme token governs them) - kept as literals
             here too, matching source exactly (see useTheme.ts's own doc comment on this). -->
        <rect
          data-testid="zoomscroll-left-handle"
          :x="zsLeftWidth - zsButtonSize / 2"
          :y="zsHeight / 2 - zsButtonSize / 2"
          :width="zsButtonSize"
          :height="zsButtonSize"
          :rx="zsButtonSize / 2"
          fill="#e0e0e0"
          stroke="#616161"
          style="cursor: e-resize"
          @mousedown="(e) => startZoomScrollDrag('left', e)"
        />
        <rect
          data-testid="zoomscroll-right-handle"
          :x="zsTrackWidth - zsRightWidth - zsButtonSize / 2"
          :y="zsHeight / 2 - zsButtonSize / 2"
          :width="zsButtonSize"
          :height="zsButtonSize"
          :rx="zsButtonSize / 2"
          fill="#e0e0e0"
          stroke="#616161"
          style="cursor: e-resize"
          @mousedown="(e) => startZoomScrollDrag('right', e)"
        />
      </g>

      <g
        v-for="(segs, j) in segmentsByTarget"
        :key="j"
        :data-series="props.target[j]"
        :style="{ cursor: props.activeEvent ? 'pointer' : undefined }"
        @mouseover="(e) => { onLineEvent('mouseover', props.target[j]); forwardEvent('mouseover', props.target[j], e) }"
        @mouseout="(e) => { onLineLeave(props.target[j]); forwardEvent('mouseout', props.target[j], e) }"
        @click="(e) => { onLineEvent('click', props.target[j]); forwardEvent('click', props.target[j], e) }"
        @dblclick="(e) => forwardEvent('dblclick', props.target[j], e)"
        @contextmenu="(e) => { e.preventDefault(); forwardEvent('contextmenu', props.target[j], e) }"
      >
        <!-- Wider invisible hit-area so a thin 2px line is easy to hover/click, per `p.css({"pointer-events":"stroke"})`. -->
        <path v-for="(seg, i) in segs" :key="`hit-${i}`" :d="seg.d" fill="none" stroke="transparent" stroke-width="16" style="pointer-events: stroke" />
        <path
          v-for="(seg, i) in segs"
          :key="i"
          :d="seg.d"
          fill="none"
          :stroke="seg.color"
          :stroke-opacity="targetOpacity(props.target[j])"
          :stroke-width="theme('lineBorderWidth')"
          :stroke-dasharray="theme('lineBorderDashArray')"
          style="pointer-events: none"
        />
      </g>

      <g v-if="props.showPoints">
        <circle
          v-for="(p, i) in points"
          :key="i"
          :cx="p.x"
          :cy="p.y"
          :r="theme('tooltipPointRadius')"
          :fill="p.color"
          :stroke="theme('linePointBorderColor')"
          :stroke-width="theme('tooltipPointBorderWidth')"
          style="cursor: pointer"
          @mouseover="onPointOver(p)"
          @mouseout="onPointOut(p)"
          @click="onLineEvent('click', p.key)"
        />
      </g>
    </g>

    <template #overlay>
      <ChartTitle v-if="props.title" :text="props.title" :width="props.width" :height="props.height" :color="theme('titleFontColor')" :size="theme('titleFontSize')" :weight="theme('titleFontWeight')" />
      <g v-if="props.showTooltip && hover">
        <ChartTooltip
          visible
          :x="hover.x"
          :y="hover.y"
          :items="[{ key: hover.key, value: formatValue(hover.value) }]"
          :background-color="theme('tooltipBackgroundColor')"
          :background-opacity="theme('tooltipBackgroundOpacity')"
          :border-color="theme('tooltipBorderColor') ?? hover.color"
          :font-color="theme('tooltipFontColor')"
          :font-size="theme('tooltipFontSize')"
        />
      </g>
      <g v-if="props.display">
        <ChartTooltip
          v-for="(p, i) in displayPoints"
          :key="i"
          visible
          :x="p.x"
          :y="p.y"
          :items="[{ value: formatValue(p.value) }]"
          :background-color="theme('tooltipBackgroundColor')"
          :background-opacity="theme('tooltipBackgroundOpacity')"
          :border-color="theme('tooltipBorderColor') ?? p.color"
          :font-color="theme('tooltipFontColor')"
          :font-size="theme('tooltipFontSize')"
        />
      </g>
      <ChartTooltip
        v-if="props.guideline && guidelineX !== null && guidelineItems.length"
        visible
        :x="guidelineX"
        :y="guidelineTooltipY"
        :items="guidelineItems.map((it) => ({ key: it.key, value: it.value }))"
        :background-color="theme('tooltipBackgroundColor')"
        :background-opacity="theme('tooltipBackgroundOpacity')"
        :border-color="theme('tooltipBorderColor') ?? theme('guidelineBorderColor')"
        :font-color="theme('tooltipFontColor')"
        :font-size="theme('tooltipFontSize')"
      />
      <ChartTooltip
        v-if="showCrosshairX && crosshairPoint && crosshairXValue !== null"
        visible
        :x="crosshairPoint.x"
        :y="area.y"
        :items="[{ value: crosshairXValue }]"
        :background-color="theme('tooltipBackgroundColor')"
        :background-opacity="theme('tooltipBackgroundOpacity')"
        :border-color="theme('tooltipBorderColor') ?? theme('crossBorderColor')"
        :font-color="theme('tooltipFontColor')"
        :font-size="theme('tooltipFontSize')"
      />
      <ChartTooltip
        v-if="showCrosshairY && crosshairPoint && crosshairYValue !== null"
        visible
        :x="area.x"
        :y="crosshairPoint.y"
        :items="[{ value: crosshairYValue }]"
        :background-color="theme('tooltipBackgroundColor')"
        :background-opacity="theme('tooltipBackgroundOpacity')"
        :border-color="theme('tooltipBorderColor') ?? theme('crossBorderColor')"
        :font-color="theme('tooltipFontColor')"
        :font-size="theme('tooltipFontSize')"
      />
    </template>
  </ChartBase>
</template>
